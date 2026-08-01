# US-008 Tab Creation Shortcuts

## Status

implemented

## Lane

normal

## Product Contract

Git Graph and Architecture tab creation actions have keyboard shortcuts. The
shortcuts are part of the shared registry, work through the global shortcut
handler, appear in the new-tab menu, and are visible/customizable in Settings.

## Relevant Product Docs

- `docs/product/keyboard-shortcuts.md`

## Acceptance Criteria

- Git Graph has a default shortcut.
- Architecture has a default shortcut.
- Both shortcuts are registered in the Settings shortcuts list.
- The new-tab menu displays the active bindings for both actions.
- Global shortcut handlers open the same views as the menu actions.

## Design Notes

- UI surfaces: new-tab menu and Settings -> Shortcuts.
- Domain rules: shortcut defaults live in `src/modules/shortcuts/shortcuts.ts`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Source regression test for shortcut registry/menu/settings wiring |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for registry-level wiring |
| Platform | Not required |
| Release | Manual menu/settings smoke |

## Harness Delta

Added `docs/product/keyboard-shortcuts.md` as the living contract for shortcut
registry behavior.

## Evidence

Pending validation.
