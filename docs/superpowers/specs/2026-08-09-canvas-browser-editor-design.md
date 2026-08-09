# Canvas Browser and Editor Nodes Design

## Goal

Let a canvas workspace host live browser and editor surfaces beside its existing
terminal nodes. Users create either surface from the floating canvas toolbar,
move and resize it with the same canvas interactions, and restore its useful
metadata when the workspace reopens.

## Product behavior

- Add Browser and Editor icon buttons beside Terminal in the canvas toolbar.
- A Browser click creates a browser node near the active canvas content with an
  empty/new-tab state. Its address bar supports URL submission, back, forward,
  reload, and opening the current URL externally.
- An Editor click creates an editor node with an empty state that can choose a
  file. Once a file is selected, the node renders the existing CodeMirror editor
  and supports the existing save shortcut and editor preferences.
- Browser and editor nodes participate in canvas selection, dragging, resizing,
  framing, locking, duplication, undo/redo, and removal. Terminal docking remains
  terminal-only.
- The active interactive node receives keyboard and pointer input. Canvas pan,
  drag, and resize temporarily block embedded native/browser/editor interaction
  so gestures do not leak into node content.
- Each node has a concise header with its surface icon, current title, and close
  affordance. Icon-only controls have accessible labels and visible focus states.

## Architecture

Extend `ArchitectureShapeKind` and `ArchitectureDiagramNode` with `browser` and
`editor` metadata. A browser node stores `url`; an editor node stores `path` and
never serializes a live webview, CodeMirror instance, file contents, or dirty
buffer. Existing canvas serialization remains the SQLite boundary and continues
to persist metadata-only diagrams.

Create focused canvas adapters rather than duplicating full product surfaces:

- `CanvasBrowserNode` owns the native Tauri child webview lifecycle while
  reusing the existing browser address bar and URL normalization behavior. It
  measures its transformed DOM host and synchronizes native bounds after canvas
  pan, zoom, resize, window movement, and visibility changes. During canvas
  interaction it hides or disables the native layer, then restores it at the
  settled bounds. Unmount always closes the child webview.
- `CanvasEditorNode` owns only canvas chrome, empty-file selection, dirty state,
  and a ref to the existing `EditorPane`. File reads and writes continue through
  the established Rust/Tauri document bridge used by `EditorPane`.
- `ArchitectureCanvas` remains the owner of diagram state, selection, history,
  geometry, and persistence. It renders each adapter by node kind and keeps the
  terminal-specific placement/docking and PTY handle code unchanged.

This follows Cate's panel registry model at the product level—Terminal, Browser,
and Editor are peers created from one toolbar—while preserving cmdSpace's
existing diagram schema and Tauri-native browser implementation.

## Placement and geometry

Browser and editor nodes use the same placement search as other rectangular
nodes, preferring open space near the active node or viewport center. Defaults:

- Browser: 720 × 480 canvas units.
- Editor: 720 × 480 canvas units.
- Minimum interactive size: 400 × 300 canvas units.

Their screen bounds are derived from the existing canvas world transform. A
native browser webview receives physical DOM bounds, not unscaled canvas bounds.
Rotation is disabled for interactive surface nodes because a native child
webview cannot safely follow arbitrary CSS rotation.

## Data and persistence

The persisted diagram adds optional fields:

```ts
url?: string;
path?: string;
```

Parsing remains backward compatible because both fields and both node kinds are
optional additions. Browser navigation commits the normalized URL to diagram
state. Selecting another editor file commits its path. Dirty editor text remains
in-memory and follows the current editor close behavior; the feature does not
silently persist unsaved file contents into SQLite.

## Failure handling

- Browser creation or navigation errors render inside the node with retry and
  external-open recovery; they do not break the canvas.
- Browser nodes fall back to the existing sandboxed iframe path when the Tauri
  child-webview runtime is unavailable in tests or web development.
- Editor read errors use the existing document error state. An empty editor node
  always offers file selection instead of mounting `EditorPane` without a path.
- Closing a node is local and recoverable through the canvas undo history, but a
  restored browser/editor creates a fresh live surface from persisted metadata.

## Testing and verification

Use test-first coverage for:

- diagram types and persistence of Browser URL and Editor path;
- toolbar controls and node creation;
- interactive-node geometry rules and terminal-only docking;
- browser lifecycle cleanup and native bounds synchronization source contract;
- editor empty state, selected path propagation, and save integration;
- rendering Browser and Editor nodes from a restored diagram.

Run focused Vitest tests, the complete frontend test/build checks required by
the repository, and `cargo check --all-targets --locked` because the release
packages a Tauri application even if this feature requires no new Rust command.

## Release

Add a root `CHANGELOG.md` in Keep a Changelog style with an Unreleased section
and a v0.7.80 entry describing canvas Browser/Editor nodes. Deliver the feature
through issue #199 and its feature PR. After merge, follow the release runbook
with a separate v0.7.80 release issue, branch, version commit, PR, tag, and
artifact verification.

## Explicit non-goals

- No terminal/browser/editor tab docking inside a single canvas node in this
  release.
- No browser automation or Cate CLI compatibility layer.
- No editor buffer persistence in SQLite.
- No changes to standard terminal renderer pooling or canvas PTY lifecycle.
