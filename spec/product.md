# dsh product specification

English | [中文](product.zh.md)

Status: Draft

Updated: 2026-08-15

## Product definition

`dsh` is an unofficial desktop distribution based on the official DeepSeek Harness. It aims to preserve the official agent capabilities and configuration model while providing a quiet, compact desktop workspace suitable for long-term use.

The product primarily supports personal exploration and DIY customization, but installation, configuration, and migration should be clear enough that a user without a local development environment can enter a DeepSeek API Key and start using it.

## Core principles

- Preserve official capabilities: keep agent execution, model integration, sessions, and the plugin system on the official implementation wherever possible.
- Prioritize the desktop experience: users should not need to open a browser, terminal, or manually start a backend.
- Layer customizations: keep the desktop shell, visual theme, and independent interaction features identifiable to reduce the cost of merging official updates.
- Keep local data understandable: users should know where their data is and have explicit ways to export, migrate, or remove it.
- Prefer stability over novelty: bind each desktop release to a tested official commit or version instead of fetching unknown code at startup.
- Label honestly: describe the distribution as an unofficial project until DeepSeek authorization is confirmed.

## Target experience

1. The user launches `dsh` from a Windows installer or portable package.
2. The application has its own taskbar icon and window, with no browser address bar or terminal window.
3. The application starts its bundled DSH backend automatically and shows the interface after the health check succeeds.
4. First use retains the official UI for entering an API Key, and the key never appears in logs, export packages, or Git.
5. Closing the last window gracefully stops the backend process started by the application.
6. The user can export migratable data and import it on another computer, then reconnect local workspace directories.

## Visual and interaction direction

- Keep the monochrome fish mark and `探索未至之境` as distinctive identity elements.
- Use a compact, neutral desktop-tool style that avoids oversized type, large pills, saturated blue, and article-like Web spacing.
- Optimize sessions, tool calls, Markdown, and the composer for scanning, comparison, and repeated operations.
- Preserve the interaction for selecting Assistant text, adding an annotation, and sending it to the composer.
- Prefer desktop conventions for later interactions, including keyboard shortcuts, context menus, compact hover actions, and stable multi-column layout.

## Phase-one scope

- A Windows x64 desktop client.
- Installer and portable distributions.
- Automatic management of one local DSH backend.
- The official DeepSeek API Key configuration and official Web capabilities.
- The current UI customizations and text annotation feature.
- Explicit data-directory, diagnostic-log, upgrade, and migration behavior.

## Not now

- Production releases for macOS, Linux, or mobile platforms.
- Custom accounts, cloud synchronization, or hosted remote sessions.
- Automatic migration of arbitrary absolute workspace paths between computers.
- Rewriting the agent core around a non-official DSH interface.
- Publishing as an "official DeepSeek client" without confirmed trademark authorization.
- In-app automatic updates in the first release; establish a reversible manual update process first.

## Success criteria

- A Windows computer without Node.js or pnpm preinstalled can install and launch the application.
- First launch supports configuring an API Key in the UI and completing one normal session.
- Window closure, backend failure, port conflict, and duplicate launch each have explicit, recoverable behavior.
- User data remains available after application upgrades and is not deleted during uninstall without confirmation.
- Installers, portable packages, and migration packages contain no API Key.
- Every release is traceable to a specific official DSH baseline and project commit.
- After an official DSH update, a fixed procedure can assess, merge, and validate it while retaining selected customizations.

## Distribution naming

The display name is provisionally `dsh`. Fix the package name, executable name, and Windows App User Model ID before the first desktop implementation so later upgrades are not recognized as a different application.

The monochrome fish mark may be used for a personal prototype. Before public distribution, separately confirm permission to use the DeepSeek name and mark; the source code's MIT license does not automatically grant trademark rights.
