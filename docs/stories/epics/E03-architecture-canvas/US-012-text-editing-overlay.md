# US-012 Text Editing Overlay

## Status

implemented

## Lane

normal

## Product Contract

Architecture text labels edit through an HTML overlay positioned above the SVG
canvas. Editing must preserve visible text, avoid duplicate editing frames, allow
multiline input, and grow the text label bounds when content becomes longer.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Double-clicking a text label opens an editor that is not clipped by SVG bounds.
- Editing a selected text label does not render a second competing text frame.
- Long text remains visible by growing the text label bounds.
- Newline input grows the text label height and renders as multiple centered SVG lines.
- Inspector edits use the same text fitting behavior as inline editing.

## Design Notes

- UI surfaces: Architecture SVG canvas, HTML edit overlay, and Inspector text field.
- Domain rules: Text nodes keep compact defaults, then fit their dimensions to
  content as the label changes.
- Rendering rule: SVG remains responsible for display and selection handles;
  HTML textarea is responsible only for active text input.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Architecture source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow canvas interaction |
| Platform | Not run |
| Release | Manual text editing smoke in Architecture tab |

## Harness Delta

None.

## Evidence

- `./node_modules/.bin/vitest run src/modules/architecture/ArchitectureStack.source.test.ts`
  passed with 18 tests.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 test files and 127 tests.
- Follow-up duplicate-text regression fixed by hiding the SVG text display while
  the HTML edit overlay is active; the same targeted, typecheck, and full Vitest
  checks passed again.
- Follow-up duplicate-frame/native-pill regression fixed by making the active
  textarea transparent and borderless, and by disabling spellcheck/autocorrect;
  the same targeted, typecheck, and full Vitest checks passed again.
- Follow-up edit-vs-display alignment regression fixed by giving the active
  textarea the same scaled font metrics and vertical centering as the SVG text;
  the same targeted, typecheck, and full Vitest checks passed again.
- Follow-up first-edit alignment regression fixed by removing the overlay's
  artificial minimum size so it uses the current text node bounds immediately;
  the same targeted, typecheck, and full Vitest checks passed again.
- Follow-up input-position regression fixed by moving active editing back into
  the text node's SVG coordinate system with a correctly bounded foreignObject
  and centered textarea; the same targeted, typecheck, and full Vitest checks
  passed again.
