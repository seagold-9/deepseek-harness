# Desktop client architecture

English | [中文](desktop-architecture.zh.md)

Status: Planned

Related decision: [ADR-0001: Use Electron](decisions/0001-electron-runtime.md)

## Overall approach

The desktop client uses Electron as a thin shell and bundles the Node.js runtime and official DSH code that match the release. The Electron main process starts the DSH Web service as a child process, waits for a successful local health check, and then loads its loopback URL in a `BrowserWindow`.

The official Web frontend depends on runtime boot data injected by the CLI server, so the desktop client does not load the static frontend directly or duplicate the agent backend.

```text
Windows dsh.exe
  -> Electron 主进程
     -> 生命周期、单实例、窗口、日志、健康检查
     -> DSH 子进程
        -> 官方 web profile 与 Agent 运行时
        -> 仅监听 127.0.0.1 的动态端口
     -> BrowserWindow
        -> 加载本地 DSH Web UI
```

## Module boundaries

### Desktop shell

Owns application startup, the single-instance lock, window state, taskbar integration, backend process lifecycle, crash reporting, log location, import/export, and release packaging.

The desktop shell does not implement model calls, the agent loop, the session protocol, or the plugin protocol. Those remain owned by official DSH.

### DSH backend

Runs as a separate child process with the release's pinned code and an application-provided `DSH_HOME`. On exit, it receives a normal termination signal and a bounded period for cleanup.

If the child process exits unexpectedly, the desktop shell shows an understandable error, a log entry point, and a retry action. Repeated restarts must be rate-limited to prevent an endless crash loop.

### Web interface

Continues to use the official plugin-based Web UI, with this project's desktop theme and independent interaction customizations layered on top.

The window permits navigation only to the loopback origin created for that launch. External links open in the system browser.

## Runtime and ports

- Use the packaged Node.js runtime without depending on a user-installed Node.js, npm, or pnpm.
- Bind the backend to `127.0.0.1` and never to a LAN address by default.
- Allocate an available dynamic port at launch and pass it to the backend through process arguments to avoid fixed-port conflicts.
- Show a local startup view until the health check succeeds instead of exposing a connection error page.
- Retain the child-process handle and a one-time launch token so the application cannot kill a DSH instance started by the user.

## Electron security baseline

- `nodeIntegration: false`
- `contextIsolation: true`
- Enable sandboxing unless a documented compatibility test proves a specific window requires an exception.
- Do not expose general filesystem, Shell, or arbitrary process-execution capabilities to the page.
- Expose only minimal IPC methods through preload, with argument validation.
- Reject unknown new windows, downloads, and cross-origin navigation.
- Protect the local service with a random startup token or equivalent session check to reduce access from other local pages.
- Redact logs by default; never record API Keys, Authorization headers, or complete credential files.

## User data

Official DSH keeps its data under `DSH_HOME`, which defaults to `~/.dsh`. The first desktop release should choose a stable, explicit Windows data directory for this distribution and set `DSH_HOME` when starting the child process. Freeze the final path during implementation after migration testing.

Long-lived data includes sessions, settings, profiles, attachments, and user plugin configuration. The official credential mechanism currently stores API Keys in `$DSH_HOME/.credentials.yaml`, and the first desktop release continues to use it.

Keep caches, temporary files, and diagnostic logs separate from migratable data so exports do not grow unnecessarily.

## Export and migration

The default export contains sessions, settings, profiles, and attachments. It excludes `.credentials.yaml`, `.env`, caches, and logs by default.

Before import, show the package version and content summary, create a recoverable backup before writing, and reject path traversal, symlink escape, and unknown formats.

Absolute workspace paths may differ on another computer. After import, let users reconnect each missing workspace and never silently redirect it to the wrong directory.

If encrypted credential migration is added later, design it as a separate specification; never put plaintext keys in a normal export package.

## Packaging and release

The first phase produces a Windows x64 NSIS installer and a portable ZIP. The installer provides Start Menu and desktop shortcuts, an uninstall entry, and a stable application identity. The portable package supports evaluation and manual migration but still stores user data in an explicit location unless the user explicitly enables a true portable-data mode.

Code signing is required before broad distribution to users unfamiliar with development tools; otherwise Windows SmartScreen creates a significant installation obstacle. Release artifacts include the MIT license and upstream copyright notices and identify the application as an unofficial distribution.

## Versioning and compatibility

Each desktop version pins a tested official DSH commit or release, and the build process never downloads "latest" code on a user's computer.

Recommended version metadata includes `desktopVersion`, `upstreamVersion`, `upstreamCommit`, and `dataSchemaVersion`. Check data compatibility before upgrading; create a backup and provide a clear warning before any irreversible migration.

See the [upstream update procedure](upstream-update.md) for handling official updates.

## Questions to validate

- The most stable readiness probe and graceful-shutdown interface for the DSH Web service.
- The complete packaged closure of plugins, native dependencies, and dynamic resources.
- Whether the Windows installer and portable distribution share one `DSH_HOME` or isolate their data directories.
- The actual protection of the official credential file on Windows and whether the system credential vault is needed.
- Whether the official mark may be used for public distribution of an unofficial client.
