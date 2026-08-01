# US-004 Snapping Arrow Endpoints

## Status

planned

## Lane

normal

## Product Contract

Architecture line and arrow endpoints must be able to attach to existing canvas
shapes. Drawing or dragging an endpoint near a shape snaps it to that shape's
boundary, and the endpoint remains attached as the shape moves.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Arrow and line endpoints snap to nearby non-drawing shapes during drawing.
- Dragging an endpoint near a shape attaches that endpoint to the shape boundary.
- Attached endpoints render on the current shape boundary when the shape moves.
- Dragging an attached endpoint away from nearby shapes detaches it.

## Design Notes

- UI surfaces: Architecture SVG canvas.
- Domain rules: connector drawing nodes store optional `connectorStartId` and
  `connectorEndId` attachments. Rendering resolves those attachments into
  boundary points without mutating the connector on every shape move.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Source regression test for connector attachment support |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this component-level interaction |
| Platform | Not required; SVG interaction is frontend-only |
| Release | Manual smoke in Architecture tab when available |

## Harness Delta

Expanded the Architecture canvas product contract with endpoint snapping and
attachment behavior.

## Evidence

Pending validation.
