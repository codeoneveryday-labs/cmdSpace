# US-010 Tool Shortcuts

## Status

implemented

## Lane

normal

## Product Contract

Architecture canvas tools have single-key shortcuts while the Architecture tab
is active. These shortcuts do not require Cmd/Ctrl and do not fire while the
user is typing in editable fields.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Select, pan, connect, line, arrow, pen, text, image, frame, and eraser have
  single-key shortcuts.
- Escape returns to Select mode.
- Shortcuts only run for the active Architecture tab.
- Inputs, textareas, selects, and contenteditable elements are ignored.
- Toolbar tooltips display the shortcut letter.

## Design Notes

- UI surfaces: Architecture canvas toolbar.
- Domain rules: these are local canvas tool accelerators, not global app
  shortcuts in Settings, because they intentionally use bare letter keys.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow canvas interaction |
| Platform | Not run |
| Release | Manual tool-switch smoke in Architecture tab |

## Harness Delta

None.

## Evidence

Pending validation.
