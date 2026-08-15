# ADR-0001: Use Electron as the desktop runtime

English | [中文](0001-electron-runtime.zh.md)

Status: Accepted, pending prototype validation

Date: 2026-08-15

## Context

The target product must launch like a normal Windows client, appear in the taskbar, manage the DSH backend automatically, and be distributable as an installer or portable package to users without a development environment.

Official DSH requires Node.js `^22.19.0 || >=24.0.0`, and its Web frontend is served by the CLI server with injected runtime data. Requiring users to install the correct Node.js and pnpm versions would prevent the desktop distribution from meeting its ready-to-use goal.

## Decision

The first desktop client will use Electron. The Electron main process owns the desktop lifecycle and starts the official DSH Web service as an independent child process; `BrowserWindow` loads only that service's loopback URL.

The DSH Host will not run inside the Electron renderer, and the project will not reimplement the agent core. The main process and DSH child process retain separate responsibilities and failure boundaries.

## Rationale

- Electron bundles a compatible Node.js runtime, reducing prerequisites on target computers.
- The current frontend is already a Web UI, so moving it into a BrowserWindow requires limited adaptation.
- The main process can reliably manage child processes, windows, single-instance behavior, logs, protocols, and installation lifecycle.
- Mature tooling exists for Windows installers, portable packaging, and code signing.
- Electron and official DSH share the TypeScript/Node ecosystem, keeping future adaptation and debugging costs relatively manageable.

## Costs

- Installer size and baseline memory use are higher than with a system WebView solution.
- Electron and its bundled Node.js security updates must be part of the release cadence.
- Packaging official DSH, plugins, and dynamic resources requires validation of the runtime closure.
- A BrowserWindow loading a local HTTP service still requires strict navigation, IPC, and loopback access controls.

## Alternatives not selected

### Tauri

Tauri usually produces smaller installers and can use the system WebView, but it does not naturally remove DSH's dependency on a specific Node.js runtime. Bundling Node.js separately or converting the backend into a sidecar would increase first-release build, debugging, and cross-machine distribution complexity.

### System browser or PWA

This is the lightest implementation, but it preserves the mixed browser context the user dislikes and provides weaker backend lifecycle, taskbar identity, exit semantics, and first-launch experience than a standalone client.

### Complete native UI rewrite

A complete rewrite would duplicate the official Web UI and protocol adaptation work, greatly increasing the cost of following Developer Preview upstream changes and conflicting with the principle of preserving official agent capabilities.

## Validation threshold

Before full implementation, the Electron prototype must prove that it requires no external Node.js, starts and gracefully stops DSH, packages plugins and static resources completely, supports API Key configuration, sessions, and attachments, handles dynamic ports and single-instance behavior reliably, and has acceptable baseline memory use and installer size.

If any obstacle cannot be resolved reasonably, add a superseding ADR instead of silently changing the technology stack.
