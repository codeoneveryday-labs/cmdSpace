# Decision 0012: Native IPC errors use namespaced codes and safe messages

Date: 2026-09-10

## Status

Accepted

## Context

cmdSpace has a large Tauri command surface. Historically, many commands
returned `Result<T, String>`, which made the frontend parse human-readable
messages and made it difficult to distinguish authorization, unavailable
resources, validation failures, and internal operation failures.

The DB boundary now has a typed `DbError` that serializes as a stable
`{ code, message }` envelope while preserving existing command names and
success payloads. The same boundary needs a durable rule before other native
modules adopt it.

## Decision

Native modules own their domain error type. At the Tauri boundary, errors expose
only:

```json
{
  "code": "DB_OPERATION_FAILED",
  "message": "database operation failed: load workspace"
}
```

Codes are namespaced by domain (`DB_*`, `FS_*`, `SHELL_*`, `PTY_*`, `REMOTE_*`,
and so on). Messages are safe summaries intended for UI/log context; raw SQL,
paths, tokens, command output, and provider response bodies stay in native logs
only when redaction policy permits them.

Each module may keep detailed source errors internally and convert them once at
its command adapter. Frontend callers should branch on codes, not message
text. Existing command names, request payload keys, and successful response
shapes remain compatibility contracts.

## Alternatives considered

- **Keep `Result<T, String>` everywhere:** rejected because string parsing is
  unstable and loses error categories at the IPC boundary.
- **Create one global `AppError` enum now:** rejected because it would couple
  unrelated modules and force a broad migration before a second module proves
  the shared seam.
- **Add Specta/another generated-binding dependency now:** rejected for this
  slice; the current manual envelope and contract tests are sufficient until a
  second IPC family exposes concrete generation requirements.

## Consequences

- DB error codes are the first stable namespace and compatibility reference.
- FS, shell, workspace, network, PTY, and remote slices can migrate
  incrementally without changing command names.
- Error-code contract tests become required whenever a module crosses the
  Tauri boundary.
- The codebase temporarily contains both typed module errors and legacy string
  errors; the remaining migration is intentional and tracked by the feature
  goal.

## Follow-ups

- Prompt 04: migrate one filesystem read slice.
- Prompt 06: migrate one shell command slice.
- Prompt 11: revisit generated IPC bindings after a second typed family exists.
- Do not introduce a shared global error crate or DB worker without a measured
  compatibility/performance reason.
