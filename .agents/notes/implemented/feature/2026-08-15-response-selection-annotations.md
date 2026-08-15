# Agent Note: Response selection annotations

Status: implemented

English | [中文](2026-08-15-response-selection-annotations.zh.md)

## Problem

Readers who want to question a precise part of an assistant response must manually copy the excerpt, preserve enough context, and return to the composer. Large Web-oriented message typography also makes long technical responses harder to scan in a desktop side panel.

## Decision

Assistant Markdown, tables, reasoning summaries, user bubbles, and the composer use a compact desktop type scale. Selecting text wholly inside one assistant response opens a fixed annotation editor near the selection. Confirmation formats the excerpt as a Markdown block quote, adds a localized note label and the reader's comment, appends that text to the addressed session's existing draft, and focuses the composer at its end. It never submits automatically.

The view injects one stable `appendAnnotation` callback per session. Chat rows receive that callback without subscribing to the draft store, so typing in the composer does not re-render response rows. The editor dismisses on Escape, outside pointer input, scrolling, or resizing without mutating the draft.

## Alternatives considered

**Submit annotations immediately.** This removes the review step and can send an incomplete or accidentally selected excerpt. Keeping the annotation in the composer preserves the normal edit and submission path.

**Store a proprietary response-reference object.** The current prompt and session log need no new durable format because a Markdown quote preserves the needed context in ordinary user text. A structured reference can be introduced later if the model or transcript requires stable response identity.

**Subscribe every chat row to composer state.** This would make response rendering track each draft keystroke. A session-scoped injected callback provides write access without adding that subscription.

## Consequences

Annotations remain editable, replay through the existing user-message path, and require no model-facing or persistence changes. A selection cannot span separate assistant response roots, and the annotation editor is intentionally unavailable when no composer callback is supplied. DOM selection behavior is covered in the chat-view test, while the injected callback test covers draft append and focus ownership.
