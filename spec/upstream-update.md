# Official upstream update procedure

English | [中文](upstream-update.zh.md)

Status: Planned

Official DeepSeek Harness is currently a Developer Preview and may introduce compatibility-breaking changes. This project follows a pinned-baseline, controlled-merge, complete-validation, explicit-rollback process instead of tracking the official main branch automatically on user devices.

## Git remote convention

The repository currently has only an official remote named `origin`: `https://github.com/deepseek-ai/deepseek-harness.git`. After creating a personal fork, use the following convention:

- `upstream`: the official DeepSeek repository, used only for fetch.
- `origin`: the personal or project fork, used to push project branches and release tags.

Changing remotes is an external repository operation. Perform and record it after the personal fork URL is known; do not invent an address now.

## Change layers

Keep long-lived history in the following logical layers wherever possible. Each layer may contain one or more small commits:

1. `upstream-dsh`: the unmodified official baseline.
2. `desktop-shell`: Electron lifecycle, packaging, logs, and migration.
3. `desktop-theme`: compact visuals, layout, and identity presentation.
4. `selection-annotation`: independent interactions such as selected-text annotations.

These names describe maintenance boundaries and do not require four long-lived, interdependent Git branches. Use one releasable main branch and a clear commit history by default to avoid prolonged multi-branch drift.

## Update steps

1. Create a protective tag or backup branch from the current releasable state and record the desktop version, upstream version, and upstream commit.
2. Fetch the target `upstream` tag or commit, then read the official release notes, migration notes, and Developer Preview breaking changes first.
3. Merge the target upstream on a dedicated update branch; never rewrite published history directly.
4. Resolve structural and contract conflicts before restoring the theme. Do not preserve the old UI by overwriting whole files.
5. Classify every local customization as "retain," "replace with official implementation," "adapt," or "remove," then update [current customizations](customizations.md).
6. Run static checks, relevant unit tests, the full build, desktop end-to-end tests, and data-upgrade tests.
7. On a clean Windows environment, smoke-test installation, first-time configuration, a session, exit, upgrade, and rollback.
8. Update specifications, ADRs, third-party notices, and release notes before producing the final installer.

## Conflict principles

- When official DSH provides equivalent or better behavior, migrate to its interface and remove the duplicate implementation.
- For visual conflicts, adapt to the new official DOM and tokens without reverting official data or interaction fixes.
- Independent features must integrate through public slots, services, or component contracts. If a deep internal modification is unavoidable, record the maintenance risk.
- Conflicts involving Host protocols, persistence formats, credentials, and security boundaries take priority over visual consistency.
- If an update cannot be adapted reliably in one cycle, continue releasing the older validated baseline instead of adopting known data risks to stay current.

## Record for each update

Every upstream update should record the following in its release notes or a dedicated update record:

- Previous and new upstream commits.
- Official version or tag.
- Adopted official capabilities.
- Retained, replaced, and removed local customizations.
- Manual conflicts and the rationale for their resolution.
- Data migration impact.
- Tests run and uncovered risks.
- Rollback target version.

## Minimum release checks

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run verify-md-wrap
pnpm run verify-md-links
git diff --check
```

After the desktop project exists, also require Electron unit tests, packaging tests, a Windows installation smoke test, backend lifecycle tests, and import/export tests. Add their exact commands to root scripts during the initial desktop implementation; do not leave them only in personal notes.
