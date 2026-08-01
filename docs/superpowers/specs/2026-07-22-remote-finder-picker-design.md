# Remote Finder Picker Design

## Goal

Replace the oversized remote file/folder selection card with a compact browser that feels like Finder while remaining fully controllable from the phone. Fix the mobile scrolling failure at its layout boundary.

## Constraints

- The native macOS file dialog cannot be used as the remote interaction surface because it opens on the Mac and cannot be operated from the phone.
- The browser must continue selecting paths on the Mac through the existing authenticated remote API.
- Existing authentication, public tunnel, QR flow, and terminal creation remain unchanged.
- Touch targets remain at least 44px and system safe areas must remain unobstructed.

## Interaction Design

The picker fills the available phone viewport instead of rendering inside a decorative card.

- A fixed top bar contains Back, the current folder name, and a compact breadcrumb/path affordance.
- The center is the only scroll region and lists folders first, then files.
- Tapping a folder navigates into it.
- Tapping a file selects its containing folder, matching the terminal's working-directory requirement.
- A fixed bottom action bar shows the selected/current path and one primary `Open` action.
- Loading, empty, and error states render inside the list region without moving either bar.
- On narrow screens the browser uses one drill-down column. Wider browser surfaces may display multiple Finder-style columns when there is enough room, without changing the API.

## Scroll Model

The root picker is constrained to `100dvh` and uses a three-row grid: header, `minmax(0, 1fr)` content, footer. The content row owns `overflow-y: auto`, `touch-action: pan-y`, and momentum scrolling. This avoids relying on page scrolling while the shared desktop stylesheet keeps `body { overflow: hidden; }`.

## Data Flow

The existing `/api/remote/folders` request and `AbortController` cancellation remain the source of truth. Navigation changes only the requested path. The selected path is passed through the existing `onSelect` callback, after which terminal creation continues unchanged.

## Validation

- Source/component test proves the picker uses a viewport-constrained grid and a dedicated scrolling list.
- Source/component test proves folder navigation and file-to-parent selection remain intact.
- Typecheck and frontend test suite pass.
- Production frontend build passes.
- Manual responsive check covers a narrow Android-sized viewport and a desktop-width browser viewport.

## Out of Scope

- Opening the native Finder dialog on the Mac.
- Uploading files from the phone.
- Mutating, renaming, deleting, or moving remote files from this picker.
