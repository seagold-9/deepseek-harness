/** Verify that the staged desktop runtime starts and serves the Web application. */

import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readyLine = /(?:^|\s)dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/u
const startupTimeoutMs = 60_000
const requestTimeoutMs = 10_000

/**
 * Create an isolated home and workspace for one staged-runtime verification.
 * @param {NodeJS.ProcessEnv} inherited Environment inherited by the smoke process.
 * @param {string} temporaryRoot Parent directory for the private temporary directory.
 * @returns {{root: string, cwd: string, env: NodeJS.ProcessEnv, dispose: () => void}} The isolated launch state.
 */
export function createRuntimeSmokeSandbox(inherited = process.env, temporaryRoot = tmpdir()) {
  const root = mkdtempSync(join(resolve(temporaryRoot), 'dsh-desktop-runtime-smoke-'))
  const dshHome = join(root, 'dsh-home')
  const agentsHome = join(root, 'agents-home')
  const cwd = join(root, 'workspace')
  for (const directory of [dshHome, agentsHome, cwd]) mkdirSync(directory)
  const env = Object.fromEntries(Object.entries(inherited).filter(([name]) => {
    return !/^DSH_/iu.test(name) && !/KEY|PASSWORD|SECRET|TOKEN/iu.test(name)
  }))
  let disposed = false
  return {
    root,
    cwd,
    env: {
      ...env,
      DSH_AGENTS_HOME: agentsHome,
      DSH_HOME: dshHome,
      HOME: root,
      NO_COLOR: '1',
      USERPROFILE: root,
    },
    dispose: () => {
      if (disposed) return
      unlinkLinksBelow(root)
      rmSync(root, { recursive: true, force: true })
      disposed = true
    },
  }
}

function unlinkLinksBelow(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const stat = lstatSync(path)
    // Unlink junctions before recursive removal so cleanup cannot traverse into the staged runtime.
    if (stat.isSymbolicLink()) {
      unlinkSync(path)
      continue
    }
    if (stat.isDirectory()) unlinkLinksBelow(path)
  }
}

async function main() {
  const runtimeRoot = resolve(process.argv[2] ?? join(desktopRoot, '.runtime'))
  const executable = join(runtimeRoot, 'node.exe')
  const entry = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const sandbox = createRuntimeSmokeSandbox()
  const child = spawn(executable, [entry, 'web', '--host', '127.0.0.1', '--port', '0'], {
    cwd: sandbox.cwd,
    env: sandbox.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let output = ''
  const appendOutput = chunk => { output = `${output}${chunk}`.slice(-16_384) }

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)

  try {
    const url = await waitForReady(child, () => output)
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) })
    if (!response.ok) throw new Error(`backend returned HTTP ${response.status}`)
    console.log(`dsh desktop runtime: ${url} returned HTTP ${response.status}`)
  } catch (error) {
    process.exitCode = 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${message}\n${redact(output).trim()}`.trim())
  } finally {
    await stopChild(child)
    sandbox.dispose()
  }
}

async function waitForReady(child, output) {
  return await new Promise((resolveReady, rejectReady) => {
    let settled = false
    const finish = callback => value => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback(value)
    }
    const resolveOnce = finish(resolveReady)
    const rejectOnce = finish(rejectReady)
    const inspect = () => {
      const match = output().match(readyLine)
      if (match?.[1] !== undefined) resolveOnce(match[1])
    }
    const timeout = setTimeout(() => {
      rejectOnce(new Error(`backend did not become ready within ${startupTimeoutMs} ms`))
    }, startupTimeoutMs)
    child.stdout.on('data', inspect)
    child.once('error', rejectOnce)
    child.once('exit', (code, signal) => {
      rejectOnce(new Error(`backend exited before readiness (code ${String(code)}, signal ${String(signal)})`))
    })
    inspect()
  })
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  let shutdownTimeout
  const graceful = await Promise.race([
    once(child, 'exit').then(() => true, () => true),
    new Promise(resolveTimeout => {
      shutdownTimeout = setTimeout(() => { resolveTimeout(false) }, 6_000)
    }),
  ])
  clearTimeout(shutdownTimeout)
  if (graceful || child.pid === undefined) return
  await new Promise(resolveKill => {
    execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => { resolveKill() })
  })
}

function redact(value) {
  return value
    .replace(/\b(Bearer\s+)[^\s"']+/giu, '$1[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/gu, '[redacted]')
    .replace(/((?:api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/giu, '$1[redacted]')
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main()
