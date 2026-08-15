# Current customizations

English | [中文](customizations.zh.md)

Status: Maintained continuously

Baseline: official commit `47f943859bef60e4160492346772ded9b24f765a`

This page records only user-visible customizations already implemented on the current branch. Unimplemented desktop features belong in the [roadmap](roadmap.md).

## Visual density

Status: Implemented

- The conversation area uses compact type sizes and line heights closer to a desktop client.
- The conversation header is compressed to about 40px to reduce the Web-page title treatment.
- The sidebar, workspace rows, and session rows are narrower and denser.
- The conversation body is wider, reducing centered article layout and large empty gaps.
- Markdown headings, lists, tables, quotations, and code blocks have tighter spacing.
- Corner radii converge on 4–8px, reducing large pills and floating-card styling.

## Conversation and tools

Status: Implemented

- User messages have less bubble styling, while Assistant text reads more like a continuous work record.
- Think and tool calls are compact, collapsible single-line records.
- Tool details, Disclosure rows, and call trees use tighter dimensions.
- The empty-session composer sits at the bottom and preserves the normal desktop chat workflow.

## Composer

Status: Implemented

- The composer is a compact rectangle with a thin border and small corner radius.
- The send button uses a neutral style without the prominent blue circle or heavy shadow.
- Composer typography matches the body density instead of using oversized Web text.

## Selected-text annotations

Status: Implemented

Selecting text in an Assistant response opens an action menu beside the selection endpoint without preventing browser copy. Choosing **Add to conversation** opens an optional-comment editor at the same endpoint and appends the selected text plus any entered note to the current composer draft.

The annotation editor has an opaque background and clear text colors. The response retains no highlight or reference number after the quote is added to the composer. The implementation is also described in `.agents/notes/implemented/feature/2026-08-15-response-selection-annotations.md` and its Chinese counterpart.

## Identity elements

Status: Implemented

- The original monochrome fish mark remains in the center of an empty session.
- The `探索未至之境` slogan and preview label remain.
- The original large blue glow is removed in favor of neutral black, white, and gray.

## Layout

Status: Implemented

The customization retains the official task, conversation, and details columns and adjusts their widths and density to feel more like a desktop workspace instead of building a parallel page structure.

## Current validation evidence

- Full suite: 84 test files and 1344 tests passed.
- Latest focused conversation-skeleton suite: 17 tests passed.
- Client TypeScript check passed.
- lint passed.
- Vite production build passed.
- The local port 3081 returned HTTP 200, and layout was checked with a headless-browser screenshot.

This evidence applies to the current worktree development state. Relevant checks must run again after later code changes; this section is not a permanent green light.

## Customization boundary

Visual customizations should remain in UI-package CSS Modules and existing slot/component boundaries wherever possible. Text annotation is an independent interaction feature and retains its own contract, tests, and Agent Note. Any theme change that requires modifying Host, agent, or persistence protocols needs a new architecture decision.
