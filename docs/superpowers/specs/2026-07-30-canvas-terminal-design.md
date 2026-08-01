# Canvas Terminal Node Design

## Goal

Replace the Architecture canvas Image toolbar action with an Add terminal action that creates an independently managed, draggable, resizable terminal node while preserving legacy image nodes in saved diagrams.

## Design

- Add `terminal` as a new architecture node kind. Keep `image` in the persisted union and renderer so existing diagrams remain readable, but remove it from the toolbar and shortcut map.
- Store terminal node geometry, title, and CWD in `ArchitectureDiagram`. PTY identity and xterm instances remain runtime-only.
- Render terminals in an HTML overlay above the SVG drawing layer. The terminal owns a direct `openPty` bridge and does not use `TerminalPane`, `useTerminalSession`, or the shared renderer pool.
- Keep Architecture tabs mounted while inactive, matching the existing stack behavior. A terminal PTY is closed when its node unmounts or is removed.
- Propagate diagram changes back through `ArchitectureCanvas` to the tab state so geometry and metadata survive canvas remounts. Restoring a terminal node starts a new shell at its saved CWD.

## Interaction

- The toolbar button keeps the existing Image slot and becomes `Add terminal` with a terminal-plus icon.
- Creating a terminal uses the current canvas point and default terminal dimensions.
- The title bar is the drag handle. The terminal body captures pointer and keyboard input without starting a canvas drag.
- Node edges/corners resize the terminal and call PTY resize after xterm fit changes.
- Delete and clear remove nodes first; React cleanup then closes their PTYs.

## Compatibility and non-goals

- No new Rust command or dependency is required; the existing PTY IPC is sufficient.
- Image nodes are not migrated or deleted from stored data.
- PTY scrollback/session identity is not restored across application restart; only node metadata and CWD are persisted.

## Verification

- Source tests prove Image is absent from the toolbar/shortcut map while legacy image normalization remains.
- Component tests prove terminal creation wiring and PTY cleanup behavior.
- Typecheck and the full Vitest suite must pass.
