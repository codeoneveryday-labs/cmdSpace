# US-011 Pen Toolbar Only

## Status

implemented

## Lane

normal

## Product Contract

Pen is available from the Architecture top toolbar and keyboard shortcut only.
It does not appear in the left Shapes palette. After one freehand stroke, Pen
stays active so users can keep drawing without reselecting it.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Pen remains available in the top toolbar.
- Pen remains available through the `P` shortcut.
- Pen is removed from the left Shapes palette.
- Completing one pen stroke leaves Pen selected for the next stroke.

## Design Notes

- UI surfaces: Architecture top toolbar and Shapes palette.
- Domain rules: Pen remains in the shape registry for rendering existing pen
  nodes, but is filtered from the left palette.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow canvas interaction |
| Platform | Not run |
| Release | Manual pen stroke smoke in Architecture tab |

## Harness Delta

None.

## Evidence

Pending validation.
