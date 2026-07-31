# US-006 Trackpad Canvas Gestures

## Status

implemented

## Lane

normal

## Product Contract

The Architecture canvas supports trackpad gestures directly on the SVG canvas.
Two-finger scroll pans the viewport without switching to the pan tool. Pinch
wheel gestures zoom around the cursor position so the point under the cursor
remains stable during zoom.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- The Architecture SVG canvas handles two-finger wheel pan gestures.
- The Architecture SVG canvas handles wheel pinch zoom gestures.
- Pinch zoom is gated to modifier wheel events, while non-modifier wheel events
  pan the canvas.
- Zoom remains clamped to the existing min/max zoom bounds.
- Toolbar zoom buttons continue to work.

## Design Notes

- UI surfaces: Architecture SVG canvas.
- Domain rules: trackpad pinch events are represented as wheel events with
  `ctrlKey` or `metaKey` set by browser/webview environments. Non-modifier
  wheel events are treated as canvas pan deltas.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow canvas interaction |
| Platform | Not run; manual Tauri trackpad smoke remains useful |
| Release | Manual pinch zoom smoke in Architecture tab |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/architecture/ArchitectureStack.source.test.ts`
  passed with 18 tests.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.
