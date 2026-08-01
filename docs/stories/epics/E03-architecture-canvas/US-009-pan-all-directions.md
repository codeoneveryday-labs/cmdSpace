# US-009 Pan All Directions

## Status

implemented

## Lane

normal

## Product Contract

The Architecture canvas pan tool moves the viewport vertically, horizontally,
and diagonally. Pan bounds include slack around the initial canvas so the tool
does not become horizontal-only when the viewport height matches the default
grid height.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- The pan tool can move the view on both X and Y axes.
- View clamping keeps a bounded working area with slack around the initial grid.
- Canvas elements can be dragged and created inside the visible left/top pan
  slack instead of stopping at the original canvas origin.
- Fit view continues to reset to the default origin and scale.

## Design Notes

- UI surfaces: Architecture SVG canvas.
- Domain rules: clamped view coordinates allow negative slack and positive slack
  beyond the initial canvas dimensions.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow canvas interaction |
| Platform | Not run; manual canvas pan smoke remains useful |
| Release | Manual pan smoke in Architecture tab |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/architecture/ArchitectureStack.source.test.ts`
  passed with 18 tests.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.
