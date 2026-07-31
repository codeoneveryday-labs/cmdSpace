# US-001 Hide Native Browser Behind Dialogs

## Status

implemented

## Lane

normal

## Product Contract

When a blocking dialog such as workspace setup is open, the sidebar browser's
native Tauri child webview must not visually cover or intercept the dialog.
The browser pane may remain mounted and should reappear after the dialog closes.

## Relevant Product Docs

- `docs/product/shell-overlays.md`

## Acceptance Criteria

- Workspace setup dialog visually stays above the sidebar browser content.
- The native sidebar browser hides while a Radix dialog is open.
- The native sidebar browser shows again after the dialog closes without losing
  its stored URL.

## Design Notes

- Commands: none.
- Queries: none.
- API: none.
- Tables: none.
- Domain rules: native webview layering cannot be solved with CSS z-index.
- UI surfaces: right sidebar browser, workspace setup dialog, shared Radix
  dialog layer.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-001 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `pnpm test -- src/modules/preview/SidebarBrowserPane.test.ts` |
| Integration | `pnpm exec tsc --noEmit` |
| E2E | Not required for this narrow component contract |
| Platform | Manual screenshot/runtime check if a Tauri dev window is available |
| Release | Covered by the normal frontend build/typecheck path |

## Harness Delta

No harness behavior changes expected.

## Evidence

- `pnpm test -- src/modules/preview/SidebarBrowserPane.test.ts`
- `pnpm test -- src/app/App.test.ts src/modules/preview/SidebarBrowserPane.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `scripts/bin/harness-cli story verify US-001`
