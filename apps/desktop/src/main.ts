/** Electron main process for the dsh desktop application. */

import { join, resolve } from 'node:path'
import { app, BrowserWindow, nativeImage, session, shell } from 'electron'
import { BackendLauncher, type BackendFailure } from './backend.ts'

const APP_ID = 'io.github.seagold9.dsh'
const WINDOW_BACKGROUND = '#f7f7f7'

let mainWindow: BrowserWindow | undefined
let backend: BackendLauncher | undefined
let backendOrigin: string | undefined
let restarting: Promise<void> | undefined
let quitting = false

app.setAppUserModelId(APP_ID)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    denyRendererPermissions()
    createMainWindow()
    await startBackend()
  }).catch((error: unknown) => {
    showFailure(error)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    if (backend === undefined) {
      app.quit()
      return
    }
    void backend.stop().finally(() => { app.quit() })
  })
}

function createMainWindow(): void {
  const icon = nativeImage.createFromPath(iconPath())
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 840,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: WINDOW_BACKGROUND,
    title: 'dsh',
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
      spellcheck: true,
    },
  })
  mainWindow = window
  restrictNavigation(window)
  window.once('ready-to-show', () => { window.show() })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  void window.loadURL(shellPage('starting'))
}

async function startBackend(): Promise<void> {
  if (restarting !== undefined) {
    await restarting
    return
  }
  restarting = startBackendOnce().finally(() => { restarting = undefined })
  await restarting
}

async function startBackendOnce(): Promise<void> {
  await backend?.stop()
  backendOrigin = undefined
  await mainWindow?.loadURL(shellPage('starting'))

  backend = new BackendLauncher({
    executable: backendExecutablePath(),
    entry: cliEntryPath(),
    cwd: app.getPath('home'),
    onUnexpectedExit: (failure) => { showBackendFailure(failure) },
  })

  try {
    const url = await backend.start()
    backendOrigin = url.origin
    await mainWindow?.loadURL(url.href)
  } catch (error) {
    const diagnostic = backend.diagnosticTail()
    await backend.stop()
    showFailure(error, diagnostic)
  }
}

function showBackendFailure(failure: BackendFailure): void {
  backendOrigin = undefined
  const summary = `Backend exited (code ${String(failure.code)}, signal ${String(failure.signal)}).`
  void mainWindow?.loadURL(shellPage('failed', summary, failure.diagnostic))
}

function showFailure(error: unknown, diagnostic = ''): void {
  const summary = error instanceof Error ? error.message : String(error)
  void mainWindow?.loadURL(shellPage('failed', summary, diagnostic))
}

function restrictNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-attach-webview', (event) => { event.preventDefault() })
  window.webContents.on('will-navigate', (event, url) => {
    if (url === 'dsh-action://retry') {
      event.preventDefault()
      void startBackend()
      return
    }
    if (isBackendUrl(url)) return
    event.preventDefault()
    if (isExternalUrl(url)) void shell.openExternal(url)
  })
  window.webContents.on('did-fail-load', (_event, code, description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3 || validatedUrl.startsWith('data:')) return
    showFailure(new Error(`Unable to load dsh (${code}: ${description}).`), backend?.diagnosticTail())
  })
}

function denyRendererPermissions(): void {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => { callback(false) })
  session.defaultSession.on('will-download', (event) => { event.preventDefault() })
}

function isBackendUrl(value: string): boolean {
  if (backendOrigin === undefined) return false
  try {
    return new URL(value).origin === backendOrigin
  } catch {
    return false
  }
}

function isExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function cliEntryPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'runtime', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    : resolve(app.getAppPath(), '..', 'cli', 'lib', 'bin.js')
}

function backendExecutablePath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'runtime', 'node.exe')
  return process.platform === 'win32' ? 'node.exe' : 'node'
}

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'assets', 'icon.png')
    : resolve(app.getAppPath(), 'build', 'icon.png')
}

function logoUrl(): string {
  return nativeImage.createFromPath(iconPath()).toDataURL()
}

function shellPage(state: 'starting' | 'failed', summary = '', diagnostic = ''): string {
  const zh = app.getLocale().toLowerCase().startsWith('zh')
  const heading = state === 'starting'
    ? zh ? '正在启动 dsh' : 'Starting dsh'
    : zh ? 'dsh 启动失败' : 'dsh could not start'
  const action = zh ? '重试' : 'Retry'
  const detail = [summary, diagnostic].filter(Boolean).join('\n\n')
  const body = `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; navigate-to dsh-action:">
<style>
:root{color-scheme:light dark;font-family:Inter,"Segoe UI",system-ui,sans-serif;background:#f7f7f7;color:#181818}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f7}
main{width:min(520px,calc(100vw - 48px));text-align:center}.mark{width:44px;height:44px;margin-bottom:18px}
h1{font-size:16px;line-height:1.4;font-weight:600;letter-spacing:0;margin:0 0 10px}
.pulse{width:120px;height:2px;margin:18px auto;background:#dedede;overflow:hidden}.pulse::after{content:"";display:block;width:42px;height:2px;background:#292929;animation:move 1.1s ease-in-out infinite}
pre{max-height:260px;overflow:auto;margin:18px 0;text-align:left;white-space:pre-wrap;word-break:break-word;border:1px solid #d8d8d8;background:#fff;padding:12px;font:12px/1.55 ui-monospace,"Cascadia Code",monospace;color:#444}
a{display:inline-block;color:#fff;background:#202020;border-radius:6px;padding:8px 18px;text-decoration:none;font-size:13px;font-weight:600}
@keyframes move{0%{transform:translateX(-42px)}50%{transform:translateX(120px)}100%{transform:translateX(-42px)}}
@media(prefers-color-scheme:dark){:root,body{background:#171717;color:#eee}.mark{filter:invert(1)}.pulse{background:#393939}.pulse::after{background:#eee}pre{background:#202020;border-color:#3b3b3b;color:#ccc}a{color:#171717;background:#eee}}
</style></head><body><main><img class="mark" src="${escapeHtml(logoUrl())}" alt=""><h1>${escapeHtml(heading)}</h1>${state === 'starting' ? '<div class="pulse"></div>' : `<pre>${escapeHtml(detail)}</pre><a href="dsh-action://retry">${escapeHtml(action)}</a>`}</main></body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(body)}`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}
