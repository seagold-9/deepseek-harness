import { describe, expect, it } from 'vitest'
import { backendEnvironment, backendUrlFromLine, OutputLines, redactDiagnostic } from '../src/backend.ts'

describe('desktop backend output', () => {
  it('finds a dynamic loopback URL across process output chunks', () => {
    const lines = new OutputLines()
    expect(lines.push('booting\ndsh web: http://127.')).toEqual(['booting'])
    expect(lines.push('0.0.1:41827\nready\r\n')).toEqual([
      'dsh web: http://127.0.0.1:41827',
      'ready',
    ])
    expect(backendUrlFromLine('dsh web: http://127.0.0.1:41827')?.href).toBe('http://127.0.0.1:41827/')
  })

  it('rejects non-loopback and unrelated URLs', () => {
    expect(backendUrlFromLine('dsh web: http://0.0.0.0:41827')).toBeUndefined()
    expect(backendUrlFromLine('open http://127.0.0.1:41827')).toBeUndefined()
  })

  it('redacts common credentials from failure diagnostics', () => {
    expect(redactDiagnostic('Authorization: Bearer secret-value\napi_key=sk-example123456789')).toBe(
      'Authorization: [redacted] [redacted]\napi_key=[redacted]',
    )
  })

  it('pins the backend to the desktop Harness home', () => {
    expect(backendEnvironment('C:\\Users\\person\\.dsh', {
      DSH_HOME: 'C:\\temporary',
      EXAMPLE: 'kept',
      NO_COLOR: '0',
    })).toEqual({
      DSH_HOME: 'C:\\Users\\person\\.dsh',
      EXAMPLE: 'kept',
      NO_COLOR: '1',
    })
  })
})
