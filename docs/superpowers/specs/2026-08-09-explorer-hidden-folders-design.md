# Explorer Hidden Folders Design

## Goal

Let users hide noisy directories from the Editor file explorer without changing the filesystem or affecting terminal, search, or AI tooling.

## Behavior

- Settings → General → Explorer shows a `Hidden folders` text input.
- Values are directory basenames separated by commas or newlines.
- Defaults are `.git`, `node_modules`, `dist`, and `target`.
- Values are trimmed, empty values are removed, and duplicates are removed while preserving order.
- Matching is exact and case-sensitive. Files with the same name are not filtered.
- The exclusion list wins over `Show hidden files`; that toggle continues to control other dot-prefixed entries.
- Enter or blur saves the draft. Loaded Explorer directories refresh immediately through the existing preferences event path.

## Architecture

Persist `explorerExcludedFolderNames` in the existing settings store. Keep parsing and filtering as pure functions beside `useFileTree`, then filter `fs_read_dir` results in the frontend so the Rust filesystem command and other consumers remain unchanged.

## Validation

Unit tests cover normalization and directory-only filtering. Source-contract tests cover the Settings input and the file-tree preference wiring. The full Vitest suite and production build must pass.
