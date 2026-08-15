/** Launches and owns the long-lived DSH Web child process. */

import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 6_000
const FORCED_SHUTDOWN_TIMEOUT_MS = 2_000
const MAX_DIAGNOSTIC_CHARS = 16_384
const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/gu
const READY_LINE = /(?:^|\s)dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/u

/** Details retained when the backend exits or fails before it becomes ready. */
export interface BackendFailure {
  /** Process exit code, or null when no numeric code was reported. */
  code: number | null
  /** Process signal, or null when no signal was reported. */
  signal: NodeJS.Signals | null
  /** Redacted and bounded stdout/stderr tail. */
  diagnostic: string
}

/** Configuration for one desktop-owned backend process. */
export interface BackendLauncherOptions {
  /** Executable used to run the bundled CLI. */
  executable: string
  /** Absolute path to the bundled DSH CLI entry. */
  entry: string
  /** Working directory inherited by new DSH sessions. */
  cwd: string
  /** Stable Harness home shared with ordinary DSH installations. */
  dshHome: string
  /** Called only when a ready backend exits without a desktop stop request. */
  onUnexpectedExit: (failure: BackendFailure) => void
  /** Startup deadline; tests may supply a shorter value. */
  startupTimeoutMs?: number
}

/** Incremental newline decoder for child-process output. */
export class OutputLines {
  private pending = ''

  /**
   * Add one output chunk.
   * @param chunk - UTF-8 process output.
   * @returns Every complete line produced by this chunk.
   */
  push(chunk: string): string[] {
    const parts = `${this.pending}${chunk}`.split(/\r?\n/u)
    this.pending = parts.pop() ?? ''
    return parts
  }

  /** @returns The final unterminated line, when present. */
  flush(): string[] {
    if (this.pending === '') return []
    const line = this.pending
    this.pending = ''
    return [line]
  }
}

/**
 * Read the loopback URL from the Web profile's stable startup line.
 * @param line - One complete stdout line.
 * @returns The URL when this is the readiness line, otherwise undefined.
 */
export function backendUrlFromLine(line: string): URL | undefined {
  const match = ANSI_ESCAPE[Symbol.replace](line, '').match(READY_LINE)
  if (match?.[1] === undefined) return undefined
  const url = new URL(match[1])
  return url.hostname === '127.0.0.1' ? url : undefined
}

/**
 * Remove common credential forms before a process diagnostic reaches the UI.
 * @param value - Untrusted process output.
 * @returns Redacted text.
 */
export function redactDiagnostic(value: string): string {
  return value
    .replace(/\b(Bearer\s+)[^\s"']+/giu, '$1[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/gu, '[redacted]')
    .replace(/((?:api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/giu, '$1[redacted]')
}

/**
 * Build the backend environment with the desktop data directory and plain diagnostics.
 * @param dshHome - Stable Harness home selected by the desktop application.
 * @param inherited - Parent environment inherited by the backend process.
 * @returns Environment for the bundled DSH process.
 */
export function backendEnvironment(
  dshHome: string,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...inherited,
    DSH_HOME: dshHome,
    NO_COLOR: '1',
  }
}

/** Process owner with bounded startup and shutdown. */
export class BackendLauncher {
  private child: ChildProcess | undefined
  private diagnostic = ''
  private stopping = false
  private stopPromise: Promise<void> | undefined

  constructor(private readonly options: BackendLauncherOptions) {}

  /**
   * Start DSH Web and wait for its loopback URL.
   * @returns The dynamically allocated backend URL.
   */
  async start(): Promise<URL> {
    if (this.child !== undefined) throw new Error('dsh desktop: backend is already running')
    this.stopping = false
    this.diagnostic = ''

    const child = spawn(this.options.executable, [this.options.entry, 'web', '--host', '127.0.0.1', '--port', '0'], {
      cwd: this.options.cwd,
      env: backendEnvironment(this.options.dshHome),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child = child

    const stdout = new OutputLines()
    const stderr = new OutputLines()
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    return await new Promise<URL>((resolve, reject) => {
      let ready = false
      let settled = false
      const timeout = setTimeout(() => {
        fail(new Error(`dsh desktop: backend did not become ready within ${this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS} ms`))
      }, this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS)

      const finish = (): void => {
        clearTimeout(timeout)
      }
      const fail = (error: Error): void => {
        if (settled) return
        settled = true
        finish()
        reject(error)
      }
      const inspect = (line: string): void => {
        this.appendDiagnostic(line)
        if (settled) return
        const url = backendUrlFromLine(line)
        if (url === undefined) return
        ready = true
        settled = true
        finish()
        resolve(url)
      }

      child.stdout.on('data', (chunk: string) => {
        for (const line of stdout.push(chunk)) inspect(line)
      })
      child.stderr.on('data', (chunk: string) => {
        for (const line of stderr.push(chunk)) this.appendDiagnostic(line)
      })
      child.once('error', (error) => { fail(error) })
      child.once('exit', (code, signal) => {
        for (const line of stdout.flush()) inspect(line)
        for (const line of stderr.flush()) this.appendDiagnostic(line)
        if (!ready) {
          fail(new Error(`dsh desktop: backend exited before readiness (code ${String(code)}, signal ${String(signal)})`))
          return
        }
        if (!this.stopping) this.options.onUnexpectedExit(this.failure(code, signal))
      })
    })
  }

  /** Stop the owned process, escalating only after graceful DSH disposal times out. */
  stop(): Promise<void> {
    if (this.stopPromise !== undefined) return this.stopPromise
    this.stopPromise = this.stopCurrent().finally(() => {
      this.stopPromise = undefined
    })
    return this.stopPromise
  }

  /** @returns The current redacted diagnostic tail. */
  diagnosticTail(): string {
    return redactDiagnostic(this.diagnostic).trim()
  }

  private async stopCurrent(): Promise<void> {
    const child = this.child
    this.child = undefined
    this.stopping = true
    if (child === undefined || hasExited(child)) return

    const gracefulExit = waitForExit(child, GRACEFUL_SHUTDOWN_TIMEOUT_MS)
    child.kill('SIGTERM')
    if (await gracefulExit) return

    await forceProcessTree(child)
    await waitForExit(child, FORCED_SHUTDOWN_TIMEOUT_MS)
  }

  private appendDiagnostic(line: string): void {
    this.diagnostic = `${this.diagnostic}${line}\n`.slice(-MAX_DIAGNOSTIC_CHARS)
  }

  private failure(code: number | null, signal: NodeJS.Signals | null): BackendFailure {
    return { code, signal, diagnostic: this.diagnosticTail() }
  }
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child)) return true
  let timeout: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<false>((resolve) => {
    timeout = setTimeout(() => { resolve(false) }, timeoutMs)
  })
  const exited = once(child, 'exit').then(() => true, () => true)
  const result = await Promise.race([exited, expired])
  if (timeout !== undefined) clearTimeout(timeout)
  return result
}

async function forceProcessTree(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || hasExited(child)) return
  if (process.platform !== 'win32') {
    child.kill('SIGKILL')
    return
  }
  await new Promise<void>((resolve) => {
    execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => { resolve() })
  })
}
