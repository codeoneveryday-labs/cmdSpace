# Decision 0013: Keep manual typed IPC at the current boundary until generation is proven

Date: 2026-09-10

## Status

Accepted

## Context

cmdSpace has a large Tauri command registry and currently maintains frontend
request/response shapes beside Rust command definitions. The workspace/DB slice
now separates a persistence row from an IPC DTO, and the filesystem read slice
has stable response discriminants and error codes.

The repository has no generated-binding dependency today. Adding one would
affect Rust and TypeScript builds, platform packaging, CI caching, and command
wire compatibility at once.

## Decision

Keep manual typed DTOs and executable contract tests as the source of truth for
the next IPC slices. Add generated bindings only after a concrete second-family
pilot demonstrates that manual maintenance is causing measurable drift or
duplicated validation.

For `fs_read_file`, the frontend adapter validates the discriminated success
union before exposing it to callers, while the Rust command remains the
authority for serialized field names and `FS_*` error codes. Existing command
names and payload keys remain unchanged.

## Alternatives considered

- **Adopt Specta/tauri-specta immediately:** rejected because dependency/build
  compatibility and generated-output ownership are not yet proven.
- **Keep unvalidated `invoke<T>` everywhere:** rejected because a type
  assertion alone cannot catch a wire-shape drift at runtime.
- **Generate a parallel schema manually:** rejected because it would create a
  third source of truth beside Rust and the current contract tests.

## Consequences

- The next IPC families can add executable parsers and contract tests without a
  new dependency.
- Manual DTO code remains temporary debt and must be revisited if a second
  family exposes repeated drift.
- Invalid native responses fail closed at the frontend boundary instead of
  reaching feature code as an unchecked object.

## Follow-ups

- Prompt 12: add the filesystem response/error contract and parser tests.
- Re-evaluate generation after at least two independent DTO families have
  measurable duplication or drift failures.

## Re-evaluation: Git status contract (2026-09-10)

The Git status adapter is the second independent family: it validates the
response DTO at runtime, preserves `GIT_*` error codes through `TauriIpcError`,
and has request/response/error contract tests. The filesystem and Git adapters
share only the generic error utility; their discriminated response validation
is domain-specific and small.

No manual drift defect or repeated validator extraction has appeared across the
two families, so generated bindings remain deferred. Re-open this decision only
when a third independent family demonstrates duplicated validator/DTO work, or
when a real Rust/frontend contract drift reaches a focused test or production
report. Any generator evaluation must first record build, packaging, license,
and generated-output ownership evidence in a new ADR.
