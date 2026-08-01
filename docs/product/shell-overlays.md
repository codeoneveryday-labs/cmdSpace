# Shell Overlays

cmdSpace renders some app surfaces with native platform layers, including the
sidebar browser's Tauri child webview. Native layers are not part of the DOM
stacking order, so blocking app overlays must explicitly suspend native content
that would otherwise cover dialogs.

## Dialog Priority

Blocking dialogs must remain visually and interactively above sidebar browser
content. The sidebar browser may stay mounted while a dialog is open, but its
native child webview must hide until the dialog closes. Workspace setup is not a
blocking overlay; it renders inline in the main workspace surface.

## Resize And Docking

The right sidebar browser uses a native Tauri child webview that sits outside the
DOM stacking order. During right-sidebar resize and docking interactions, the
native child webview must hide until the interaction ends, then resync its bounds
before showing again. This prevents stale native bounds from covering terminal
panes or other workspace content while the DOM layout is moving.
