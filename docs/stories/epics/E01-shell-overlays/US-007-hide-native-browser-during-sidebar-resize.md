# US-007 Hide Native Browser During Sidebar Resize

## Status

implemented

## Lane

normal

## Product Contract

When the right sidebar browser is active, resizing or docking the sidebar must
not leave the native child webview visibly lagging over workspace content. The
native browser layer hides during the resize interaction and reappears after its
bounds are synced.

## Relevant Product Docs

- `docs/product/shell-overlays.md`

## Acceptance Criteria

- The sidebar browser still uses a native Tauri child webview for public sites.
- Blocking dialogs continue to hide the native webview.
- Right-sidebar resize interactions also hide the native webview.
- Iframe fallback behavior for non-Tauri development remains unchanged.

## Design Notes

- UI surfaces: right sidebar browser and app shell resize separator.
- Domain rules: native child webviews are outside DOM layout and should be
  suspended during fast chrome layout movement.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Sidebar browser source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow shell overlay change |
| Platform | Manual Tauri resize smoke remains useful |
| Release | User-visible browser resize/dock smoke |

## Harness Delta

None.

## Evidence

Pending validation.
