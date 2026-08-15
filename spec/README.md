# dsh project specifications

English | [中文](README.zh.md)

This directory contains the product specifications, architecture decisions, and maintenance procedures for this personal distribution, kept separate from the official DeepSeek Harness `docs/` hierarchy.

The project currently derives from the official DeepSeek Harness repository. Its working branch is `ui-experiment`, and its baseline commit is `47f943859bef60e4160492346772ded9b24f765a` (2026-08-13). The current `origin` remote still points to the official repository; after creating a personal GitHub fork, rename the remotes as described in the [upstream update procedure](upstream-update.md).

## Document index

- [Product specification](product.md): product positioning, target users, scope, and acceptance criteria.
- [Desktop client architecture](desktop-architecture.md): process, data, security, packaging, and migration design.
- [Current customizations](customizations.md): UI and interaction changes that are already implemented.
- [Roadmap](roadmap.md): phases from the current Web experiment to a distributable desktop client.
- [Upstream update procedure](upstream-update.md): how to follow official releases, resolve conflicts, and validate a release.
- [ADR-0001: Use Electron](decisions/0001-electron-runtime.md): the desktop runtime choice and its rationale.

## Status vocabulary

- `Implemented`: the code exists in the current worktree and has passed the corresponding validation.
- `Planned`: the direction is agreed, but implementation has not started.
- `To decide`: a prototype, test, or user decision is still required.
- `Not now`: outside the current phase and not a committed feature.

## Maintenance rules

1. Define product boundaries only in the [product specification](product.md); other documents link to it instead of creating duplicate requirements.
2. Add or supersede an ADR before changing the architecture. Keep superseded ADRs and mark their status instead of deleting history.
3. After completing a user-visible customization, update its status and validation evidence in [current customizations](customizations.md).
4. For every official update, follow the [upstream update procedure](upstream-update.md) and record the baseline, conflicts, and test results.
5. Never commit API Keys, real user directories, session contents, or machine-specific paths to Git.
6. The `spec/` directory belongs to this project and is not product documentation intended for the official upstream repository.

## Current facts

- Source directory: `D:\repos\deepseek-harness`
- Current branch: `ui-experiment`
- Current development URL: `http://127.0.0.1:3081/?ui-experiment=1`
- Official repository: `https://github.com/deepseek-ai/deepseek-harness.git`
- Current phase: Web UI customization is implemented; the desktop client is in specification design.
