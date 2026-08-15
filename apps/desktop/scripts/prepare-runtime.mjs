/** Prepare the production DSH dependency closure consumed by electron-builder. */

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(desktopRoot, '..', '..')
const runtimeRoot = join(desktopRoot, '.runtime')
const expectedNodeVersion = 'v24.14.0'
const pnpmCli = process.env.npm_execpath

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`desktop runtime requires a Windows x64 build host, received ${process.platform} ${process.arch}`)
}
if (process.version !== expectedNodeVersion) {
  throw new Error(`desktop runtime requires Node ${expectedNodeVersion}, received ${process.version}`)
}
if (pnpmCli === undefined || !pnpmCli.endsWith('.mjs')) {
  throw new Error('desktop runtime preparation must run through its pnpm script')
}

rmSync(runtimeRoot, { recursive: true, force: true })
execFileSync(process.execPath, [pnpmCli,
  '--config.inject-workspace-packages=true',
  '--config.node-linker=hoisted',
  '--filter', '@deepseek-ai/dsh-desktop-runtime',
  'deploy', runtimeRoot, '--prod', '--ignore-scripts',
], { cwd: repositoryRoot, stdio: 'inherit' })
assertNoFilesystemLinks(runtimeRoot)
copyFileSync(process.execPath, join(runtimeRoot, 'node.exe'))

const cliEntry = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
if (!existsSync(cliEntry)) throw new Error(`desktop runtime is missing ${cliEntry}`)

const runtimeRequire = createRequire(join(runtimeRoot, 'package.json'))
const dshManifest = runtimeRequire.resolve('@deepseek-ai/dsh/package.json')
const dshRequire = createRequire(dshManifest)
const webAppManifest = dshRequire.resolve('@deepseek-ai/dsh-web-app/package.json')
const webAppRequire = createRequire(webAppManifest)
webAppRequire.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')
assertRequiredPeersResolveInsideRuntime()

function assertNoFilesystemLinks(root) {
  const links = []
  const pending = [root]
  while (pending.length > 0) {
    const directory = pending.pop()
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name)
      if (entry.isSymbolicLink()) links.push(relative(root, child))
      else if (entry.isDirectory()) pending.push(child)
    }
  }
  if (links.length === 0) return
  throw new Error(`desktop runtime contains filesystem links:\n${links.sort().map(link => `  ${link}`).join('\n')}`)
}

function assertRequiredPeersResolveInsideRuntime() {
  const missing = new Map()
  for (const manifest of packageManifests(join(runtimeRoot, 'node_modules'))) {
    const packageJson = JSON.parse(readFileSync(manifest, 'utf8'))
    const packageRequire = createRequire(manifest)
    for (const peer of Object.keys(packageJson.peerDependencies ?? {})) {
      if (packageJson.peerDependenciesMeta?.[peer]?.optional === true) continue
      try {
        const resolved = packageRequire.resolve(peer)
        const runtimeRelative = relative(runtimeRoot, resolved)
        if (runtimeRelative.startsWith('..') || isAbsolute(runtimeRelative)) throw new Error('resolved outside runtime')
      } catch {
        const owners = missing.get(peer) ?? []
        owners.push(packageJson.name ?? manifest)
        missing.set(peer, owners)
      }
    }
  }
  if (missing.size === 0) return
  const details = [...missing.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([peer, owners]) => `  ${peer}: ${[...new Set(owners)].sort().join(', ')}`)
    .join('\n')
  throw new Error(`desktop runtime is missing required peer dependencies:\n${details}`)
}

function packageManifests(root) {
  const manifests = []
  const pending = [root]
  while (pending.length > 0) {
    const directory = pending.pop()
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '.bin') continue
      const child = join(directory, entry.name)
      const manifest = join(child, 'package.json')
      if (existsSync(manifest)) manifests.push(manifest)
      else pending.push(child)
    }
  }
  return manifests
}
