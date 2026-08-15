# Agent Note: Response selection annotations

Status: implemented

English | [中文](2026-08-15-response-selection-annotations.zh.md)

## Problem

Readers who want to question a precise part of an assistant response must manually copy the excerpt, preserve enough context, and return to the composer. Large Web-oriented message typography also makes long technical responses harder to scan in a desktop side panel.

## Decision

Assistant Markdown, tables, reasoning summaries, user bubbles, and the composer use a compact desktop type scale. A pointer selection that starts wholly inside one assistant response preserves the browser selection and opens a fixed action menu beside the pointer release point, including when the pointer is released beyond the response edge. This endpoint anchor keeps the action visible near the user's last interaction even when a selection spans several lines, paragraphs, or table cells. Choosing **Add to conversation** opens an editor at the same anchor for an optional comment. Confirmation formats the excerpt as a Markdown block quote, adds the localized note label when a comment exists, appends that text to the addressed session's existing draft, and focuses the composer at its end. The response receives no persistent highlight or reference number, and confirmation never submits automatically.

The view injects one stable `appendAnnotation` callback per session. Chat rows receive that callback without subscribing to the draft store, so typing in the composer does not re-render response rows. The menu and editor dismiss on Escape, outside pointer input, scrolling, or resizing without mutating the draft. No side-chat action renders because this application has no secondary chat destination.

## Alternatives considered

**Submit annotations immediately.** This removes the review step and can send an incomplete or accidentally selected excerpt. Keeping the annotation in the composer preserves the normal edit and submission path.

**Store a proprietary response-reference object.** The current prompt and session log need no new durable format because a Markdown quote preserves the needed context in ordinary user text. A structured reference can be introduced later if the model or transcript requires stable response identity.

**Keep numbered highlights on referenced response text.** Multiple annotations require session-wide numbering plus defined behavior for draft edits, deletion, submission, transcript replay, and duplicate excerpts. A transient marker that resets or disappears at an unrelated time is misleading, so the response remains unchanged after the quote enters the composer.

**Subscribe every chat row to composer state.** This would make response rendering track each draft keystroke. A session-scoped injected callback provides write access without adding that subscription.

## Consequences

Annotations remain editable, replay through the existing user-message path, and require no model-facing or persistence changes. Ordinary browser copy remains available before the user chooses the annotation action. A selection cannot span separate assistant response roots, and the annotation action is intentionally unavailable when no composer callback is supplied. Chat-view tests cover partial selections, endpoint-relative placement, whole-paragraph drags released outside the response, and optional comments; the injected callback test covers draft append and focus ownership.
