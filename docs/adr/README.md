# Architecture Decision Records

Every meaningful architecture decision in cmdSpace is recorded here, following
the template in [`0000-template.md`](0000-template.md). ADRs are append-only:
when a decision changes, write a new ADR that supersedes the old one.

> Note: `docs/decisions/` (0001–0009) are the older **Harness** decision
> records with a different format. They are kept as-is; this directory is the
> home for app-architecture ADRs.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-two-process-model.md) | Two-process model — webview never touches the OS | accepted |
| [0002](0002-terminal-renderer-pool.md) | Terminal renderer pool — rebind, don't recreate | accepted |
| [0003](0003-macos-ime-bridge.md) | macOS IME bridge — normalize spaces at the boundary | accepted |
