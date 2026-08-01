# US-003 Editable Arrow Handles

## Status

planned

## Lane

normal

## Product Contract

Architecture line and arrow drawings must be editable after creation. When a
line or arrow is selected, the user can drag the tail, the curve handle in the
middle, or the head to reshape the connector without recreating it.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Selected line and arrow drawings show handles at the start, middle curve, and end.
- Dragging the middle handle bends the connector.
- Dragging either end moves that endpoint while preserving the existing curve shape.
- Locked connectors remain visible but do not expose editable handles.

## Design Notes

- UI surfaces: Architecture SVG canvas drawing tools.
- Domain rules: free drawing connectors are `ArchitectureNode` items with
  relative endpoint dimensions and an optional relative control point.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Source regression test for connector handle support |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this component-level interaction |
| Platform | Not required; SVG interaction is frontend-only |
| Release | Manual smoke in Architecture tab when available |

## Harness Delta

Added `docs/product/architecture-canvas.md` to make the Architecture canvas
interaction contract explicit.

## Evidence

Pending validation.
