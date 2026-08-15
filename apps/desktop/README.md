# dsh Desktop

English | [中文](README.zh.md)

The desktop app packages the official DSH Web profile behind a restricted Electron window. It includes a standard Node.js runtime, starts DSH on an OS-assigned loopback port, and stops the backend when the app exits. The [desktop-app Agent Note](../../.agents/notes/implemented/feature/2026-08-15-windows-desktop-app.md) records the distribution and lifecycle decisions.

## Runtime layout

Electron owns the window and process lifecycle. A bundled `node.exe` runs the ordinary built `dsh web --host 127.0.0.1 --port 0` entry, so the backend remains the official Web composition rather than a desktop-specific fork. The desktop runtime manifest at [`../desktop-runtime/package.json`](../desktop-runtime/package.json) closes the production dependency set, including required peer dependencies.

The shell explicitly starts the backend with `DSH_HOME` set to the ordinary user directory (`~/.dsh`). User profiles, sessions, settings, and credential references therefore survive application upgrades, replacement, and switching between the installed and portable packages. Electron browser state is separate under the OS application-data directory. The app does not copy API keys into its installation directory or repository.

## Development

Build the repository before launching the desktop shell:

```sh
pnpm run build
pnpm run desktop:dev
```

The app starts its own backend on a dynamic port. It does not reuse or stop a separately launched `dsh web` process.

## Windows packages

The Windows build requires Node.js `v24.14.0` x64. Runtime preparation fails when another Node version or platform is used.

```sh
pnpm run desktop:dist
```

The command compiles the shell, generates the whale icon, deploys a production-only runtime with no filesystem links, starts that runtime and requires an HTTP 200 response, then writes these files under `apps/desktop/release/`:

| Artifact | Use |
|---|---|
| `dsh-Setup-0.1.0-rc.5-x64.exe` | Recommended installation with desktop and Start menu shortcuts. |
| `dsh-Portable-0.1.0-rc.5-x64.exe` | Self-extracting copy for temporary use or transfer between computers. |

Target computers do not require Node.js or pnpm. The installed app starts directly from its `dsh` shortcut. The portable artifact contains the same runtime but extracts the complete Electron application on every launch; Windows security scanning can make that path substantially slower than the installed app.

The packages are unsigned, so Windows SmartScreen may warn before launch. Public distribution also requires review of the DeepSeek name and logo usage.

## Security and failure behavior

The renderer has no Node.js integration or preload API, runs with context isolation and Chromium sandboxing, and may navigate only within the backend origin selected for the current launch. External HTTP links open in the system browser. Renderer permission requests, downloads, and embedded webviews are denied.

The shell retains only a bounded, redacted process-output tail in memory for startup diagnostics. A backend startup failure produces a local retry page. Closing the window first requests graceful DSH disposal, then terminates the owned process tree if shutdown exceeds the bounded deadline.
