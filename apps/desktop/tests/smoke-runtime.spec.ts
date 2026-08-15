import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

interface RuntimeSmokeSandbox {
  root: string
  cwd: string
  env: NodeJS.ProcessEnv
  dispose(): void
}

interface RuntimeSmokeModule {
  createRuntimeSmokeSandbox: (inherited?: NodeJS.ProcessEnv, temporaryRoot?: string) => RuntimeSmokeSandbox
}

describe('desktop runtime smoke sandbox', () => {
  it('does not inherit persistent Harness or agent directories', async () => {
    const moduleUrl = new URL('../scripts/smoke-runtime.mjs', import.meta.url).href
    const { createRuntimeSmokeSandbox } = await import(moduleUrl) as RuntimeSmokeModule
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'dsh-desktop-runtime-smoke-test-'))
    try {
      const sandbox = createRuntimeSmokeSandbox({
        DEEPSEEK_API_KEY: 'secret',
        Dsh_Agents_Home: 'C:\\Users\\person\\.agents',
        dsh_home: 'C:\\Users\\person\\.dsh',
        DSH_STALE_PARENT: 'stale',
        EXAMPLE: 'kept',
        HOME: 'C:\\Users\\person',
        NO_COLOR: '0',
        USERPROFILE: 'C:\\Users\\person',
      }, temporaryRoot)
      expect(sandbox.env).toMatchObject({
        DSH_AGENTS_HOME: join(sandbox.root, 'agents-home'),
        DSH_HOME: join(sandbox.root, 'dsh-home'),
        EXAMPLE: 'kept',
        HOME: sandbox.root,
        NO_COLOR: '1',
        USERPROFILE: sandbox.root,
      })
      expect(sandbox.env.DEEPSEEK_API_KEY).toBeUndefined()
      expect(sandbox.env.Dsh_Agents_Home).toBeUndefined()
      expect(sandbox.env.dsh_home).toBeUndefined()
      expect(sandbox.env.DSH_STALE_PARENT).toBeUndefined()
      expect(sandbox.cwd).toBe(join(sandbox.root, 'workspace'))
      expect(existsSync(sandbox.root)).toBe(true)

      const target = join(temporaryRoot, 'junction-target')
      mkdirSync(target)
      writeFileSync(join(target, 'witness'), 'preserved')
      symlinkSync(target, join(sandbox.root, 'junction'), process.platform === 'win32' ? 'junction' : 'dir')

      sandbox.dispose()
      sandbox.dispose()
      expect(existsSync(sandbox.root)).toBe(false)
      expect(existsSync(join(target, 'witness'))).toBe(true)
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})
