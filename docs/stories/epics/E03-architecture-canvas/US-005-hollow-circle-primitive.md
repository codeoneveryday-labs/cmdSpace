# US-005 Hollow Circle Primitive

## Status

implemented

## Lane

tiny

## Product Contract

Architecture circle drawing primitives render as hollow outline shapes, matching
the rectangle primitive and preserving visibility of the canvas grid and
connectors through the interior.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Circle primitives use a transparent SVG fill.
- Rectangle primitive behavior is unchanged.
- Source tests protect the hollow circle rendering contract.

## Design Notes

- UI surfaces: Architecture SVG canvas.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for a narrow SVG rendering change |
| Platform | Not required |
| Release | Manual visual smoke in Architecture tab when available |

## Harness Delta

None.

## Evidence

Pending validation.
