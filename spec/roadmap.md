# dsh roadmap

English | [中文](roadmap.zh.md)

Status: Planned

The roadmap defines order and completion criteria, not calendar commitments. Each phase must pass acceptance before the next begins.

## Phase 0: Project baseline

Status: In progress

- Establish `spec/`, product boundaries, architecture decisions, and the upstream update procedure.
- Organize the existing UI customizations into a reviewable commit sequence.
- Create a personal GitHub fork and configure the official repository as read-only `upstream`.
- Pin the current official baseline, Node/pnpm versions, and validation commands.

Completion criterion: another developer can distinguish official code, current customizations, and planned features from the repository documentation alone and can reproduce the current Web development environment.

## Phase 1: Desktop technical validation

Status: Not started

- Add a minimal Electron workspace application.
- Start the official DSH child process and load its loopback Web UI.
- Validate dynamic ports, readiness checks, graceful shutdown, duplicate launch, and backend crash recovery.
- Confirm that plugins, static resources, and the Node.js runtime are complete after production packaging.
- Establish the minimum security baseline and navigation-restriction tests.

Completion criterion: a test computer without Node.js installed can launch the packaged prototype, configure an API Key, complete a session, and exit cleanly.

## Phase 2: Daily-use Alpha

Status: Not started

- Add the application icon, independent taskbar identity, restored window state, and single-instance behavior.
- Complete startup, loading, backend-error, port-error, and recovery views.
- Freeze the `DSH_HOME` path and upgrade behavior.
- Retain the current compact UI and selected-text annotation feature.
- Add redacted logs and a one-click action to open the diagnostics directory.

Completion criterion: extended use, restarts, and abnormal exits do not lose sessions, and common failures do not require a terminal.

## Phase 3: Migratable Beta

Status: Not started

- Implement versioned export manifests, validation, backup, and import.
- Exclude credentials, logs, and caches by default.
- Provide workspace reconnection for missing paths.
- Produce a Windows x64 NSIS installer and portable ZIP.
- Test installation, upgrade, uninstall, and migration in a clean virtual machine.

Completion criterion: a user can move non-sensitive DSH data to another computer and continue after re-entering an API Key and reconnecting workspaces.

## Phase 4: Ready for external distribution

Status: Not started

- Confirm the use of the name, mark, and unofficial-project notice.
- Configure Windows code signing, release verification, and checksum files.
- Establish release notes, known issues, and rollback instructions.
- Rehearse at least one complete official DSH upstream update.
- Decide whether to add in-app updates; do not enable them without reliable signing and rollback.

Completion criterion: non-developer users can understand installation warnings, configure the application, and upgrade or roll back. Release artifacts are traceable and contain no developer or test-user data.

## Later candidates

The following remain to decide: macOS distribution, Linux distribution, system credential vault integration, in-app automatic updates, multiple windows, tray residency, and a custom plugin marketplace. Each requires a separate specification and must not enter the first release implicitly.
