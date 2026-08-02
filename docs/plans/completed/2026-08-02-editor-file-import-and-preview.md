# Execution Plan: Editor file import and image preview

Date: 2026-08-02

## Status

Completed

## Outcome

The editor previews supported image files, Explorer imports external files by drop or paste, and Explorer drag-and-drop moves workspace files without overwriting another path.

## Context

- `src/modules/editor/EditorPane.tsx` labelled every binary file unsupported.
- `src/modules/explorer/` owns tree interaction and local mutations.
- `src-tauri/src/modules/fs/` owns filesystem mutations and the Tauri bridge.

## Scope

In scope:

- Image preview in editor.
- Native and webview file drop/import plus clipboard file paste.
- Move files and folders between Explorer folders with conflict and descendant guards.

Out of scope:

- Generic video, PDF, or office-document preview.
- Overwriting or merging existing destination files.

## Approach

1. Add bounded image and binary-import filesystem commands plus safe recursive external import and move helpers.
2. Add Explorer drag/drop and paste handlers that target the selected folder and refresh affected tree branches.
3. Render image content in `EditorPane` for supported binary image paths.
4. Add focused source and Rust tests, then run frontend and Rust verification.

## Risks And Recovery

- Import failures can leave partial directory copies; clean up the newly created target before returning an error.
- A bad drag target can move a folder into itself; reject descendants in both frontend and Rust.
- Rollback is a clean revert of this branch; no file operation overwrites an existing path.

## Progress

- [x] Implement safe Rust file import/move and image data reading.
- [x] Implement Explorer drop/paste/move interactions.
- [x] Implement image preview.
- [x] Add focused regression coverage and run validation.

## Decisions

- 2026-08-02: Native Tauri drop paths are the primary external-import route; DOM drop and paste act as development/webview fallbacks.
- 2026-08-02: Existing paths are never overwritten during import or move.

## Validation

- Focused proof: Rust fs unit tests and editor/explorer source tests.
- Integration or end-to-end proof: packaged app manual drag/drop and paste.
- Repository-required checks: `pnpm build`, `cargo check --all-targets --locked`.

## Result

Supported images now render in the editor via a bounded native data-URL read. Explorer accepts native external drops, browser file drops, and clipboard files, and it moves selected files or folders through its internal drag-and-drop path. Imports refuse overwrites and symlinks; moves refuse self-descendant targets.

Validation is recorded in the PR after the focused Vitest suite, frontend build, Rust filesystem tests, Cargo check, and Clippy complete. Packaged-app manual verification of Finder drag/drop and Finder clipboard file payloads remains a release QA check.
