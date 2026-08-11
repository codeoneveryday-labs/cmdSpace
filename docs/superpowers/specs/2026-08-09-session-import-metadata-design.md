# Session Import Metadata Design

## Goal

Make imported sessions identifiable without relying on opaque session IDs.

## Metadata

For Codex JSONL sessions, use the first `event_msg` whose payload type is `user_message`. Collapse whitespace and expose up to 160 characters as the preview. Use that preview as the display title while retaining the existing `Codex session <id>` fallback when no user message exists. Other providers keep their existing native title and preview sources.

## Presentation

Each picker row displays a single-line title, a single-line preview when it differs from the title, the working directory, and a compact relative activity time such as `1m ago`, `2h ago`, or `5d ago`. Single-line CSS truncation supplies an ellipsis without modifying the underlying searchable text. Multiple-selection state remains visible through the checkbox and selected styling.

## Constraints

Session discovery remains local and offline. Parsing stops once Codex metadata and the first user message are found, and malformed JSONL lines continue to be ignored.
