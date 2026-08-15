# Agent Note: Windows desktop app over the official Web profile

Status: implemented

English | [中文](2026-08-15-windows-desktop-app.zh.md)

## Problem

The DSH Web profile requires users to start a command, retain its terminal, find a browser tab, and distinguish that tab from unrelated browser work. A distributable desktop application must preserve the official Web behavior and user data while providing one taskbar application, ordinary shortcuts, single-instance behavior, and no target-machine Node.js or pnpm prerequisite.

Electron cannot also serve as the backend runtime. Electron 43 embeds Node.js 24, but its executable and module environment do not load the vendored Cordis ESM graph in the same way as the supported standard Node.js runtime. A desktop package also needs a closed production dependency set: pnpm peer dependencies supplied by the workspace root are otherwise absent after isolated deployment.

## Decision

[`apps/desktop`](../../../../apps/desktop/README.md) is a Windows x64 Electron shell over the official built `dsh web` entry. Electron owns only the window, navigation policy, single-instance lock, and backend lifecycle. A bundled standard Node.js `v24.14.0` executable runs the backend on `127.0.0.1` with port `0`; the shell reads the emitted URL and loads that origin. The desktop application does not fork the Web composition or introduce an IPC client implementation.

The renderer uses Chromium sandboxing and context isolation with Node.js integration disabled. It has no preload bridge. Navigation remains on the launch-specific backend origin, external HTTP links open in the system browser, and permissions, downloads, new embedded windows, and webviews are denied.

Closing the last window initiates application quit. Quit waits for graceful backend disposal, then terminates the owned Windows process tree after bounded deadlines. Startup diagnostics retain a bounded output tail, redact common credential forms before display, and expose a retry action without granting renderer access to the host.

## Runtime distribution

[`apps/desktop-runtime/package.json`](../../../../apps/desktop-runtime/package.json) is a zero-code deploy root for the desktop backend. It declares `@deepseek-ai/dsh` and every required non-optional peer dependency that the shipped graph expects from its host. Runtime preparation uses isolated pnpm deployment with injected workspace packages and a hoisted layout, rejects any required peer that cannot resolve within the staged runtime, rejects filesystem links, and embeds the exact build-host `node.exe`.

Electron Builder receives `node.exe` and `node_modules` as separate explicit resource sets. The split prevents its application-dependency filtering from dropping the nested runtime. The NSIS installer and portable executable contain the same backend bytes; target computers require neither Node.js nor pnpm. This closed-manifest approach is related to, but does not supersede, the [single-file SDK runtime distribution](../architecture/2026-07-10-single-file-executable-sdk-runtime-distribution.md).

## Verification

The backend launcher has focused tests for fragmented readiness output, URL validation, and diagnostic redaction. The package build performs strict TypeScript compilation and a runtime smoke test that starts the staged `node.exe`, waits for the dynamically assigned URL, requires an HTTP 200 response, and stops the process.

Release verification starts the unpacked application from its packaged path, observes one loopback listener owned by the bundled Node process, loads the real Web page, launches a second instance and observes only one main process and backend, closes the window, and observes no remaining owned process. The installer verification also requires registered uninstall metadata plus desktop and Start menu shortcuts.

## Alternatives considered

**Keep the browser as the only UI host.** Rejected because a browser tab does not provide the requested taskbar identity, shortcut launch, single-instance ownership, or app-specific window policy.

**Run the backend through Electron's executable with `ELECTRON_RUN_AS_NODE`.** Rejected because the embedded runtime failed on the real vendored loader graph. Sharing a major Node version does not make Electron's module environment an interchangeable supported runtime.

**Build a desktop-specific frontend or IPC carrier.** Rejected because it would duplicate the official Web client and increase update drift without a current desktop-only capability. The existing loopback carrier already preserves the complete product behavior.

**Require Node.js and an installed `dsh` command on the target computer.** Rejected because installation state, versions, and peer resolution would vary by machine and prevent transfer as one tested application.

**Ship only the portable executable.** Rejected as the primary path because the self-extracting package expands the complete Electron and DSH file tree on every launch. The installer pays that cost once and provides the ordinary long-lived application experience.

## Consequences

The desktop application follows Web-profile updates at the package and frontend build boundary: rebuilding the closed runtime and Electron resources carries the updated official composition without reimplementing it. User profiles and credentials remain in the ordinary DSH home and survive application upgrades or replacement.

The distribution is Windows x64 only, pins one standard Node.js build, and is unsigned. Its unpacked application is large and contains tens of thousands of dependency files. Installation can be slow under Windows security scanning, while the portable executable repeats that extraction cost on every launch; the installed shortcut is the supported daily-use path. A future archive-and-cache design may reduce file-count overhead, but it must preserve the runtime closure check, atomic publication, version isolation, cleanup, and backend shutdown behavior recorded here.
