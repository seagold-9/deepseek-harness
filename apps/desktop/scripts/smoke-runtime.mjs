/** Verify that the staged desktop runtime starts and serves the Web application. */

import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = resolve(process.argv[2] ?? join(desktopRoot, '.runtime'))
const executable = join(runtimeRoot, 'node.exe')
const entry = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const readyLine = /(?:^|\s)dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/u
const startupTimeoutMs = 60_000
const requestTimeoutMs = 10_000

const child = spawn(executable, [entry, 'web', '--host', '127.0.0.1', '--port', '0'], {
  cwd: desktopRoot,
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let output = ''
let settled = false
let timeout

child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', (chunk) => {
  appendOutput(chunk)
  const match = output.match(readyLine)
  if (match?.[1] !== undefined) void verifyUrl(match[1])
})
child.stderr.on('data', appendOutput)
child.once('error', fail)
child.once('exit', (code, signal) => {
  if (!settled) fail(new Error(`backend exited before readiness (code ${String(code)}, signal ${String(signal)})`))
})

timeout = setTimeout(() => {
  fail(new Error(`backend did not become ready within ${startupTimeoutMs} ms`))
}, startupTimeoutMs)

async function verifyUrl(url) {
  if (settled) return
  settled = true
  clearTimeout(timeout)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) })
    if (!response.ok) throw new Error(`backend returned HTTP ${response.status}`)
    console.log(`dsh desktop runtime: ${url} returned HTTP ${response.status}`)
  } catch (error) {
    process.exitCode = 1
    console.error(error instanceof Error ? error.message : String(error))
  } finally {
    await stopChild()
  }
}

function fail(error) {
  if (settled) return
  settled = true
  clearTimeout(timeout)
  process.exitCode = 1
  console.error(`${error.message}\n${redact(output).trim()}`.trim())
  void stopChild()
}

function appendOutput(chunk) {
  output = `${output}${chunk}`.slice(-16_384)
}

async function stopChild() {
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
