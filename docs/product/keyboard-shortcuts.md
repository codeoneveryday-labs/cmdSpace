# Keyboard Shortcuts

cmdSpace keeps keyboard shortcuts in a shared registry used by the global
shortcut handler, the new-tab menu, the shortcuts dialog, and Settings.

## New Tab Shortcuts

- Terminal: `Cmd/Ctrl+T`
- Private terminal: `Cmd/Ctrl+R`
- Editor: `Cmd/Ctrl+E`
- Preview: `Cmd/Ctrl+P`
- Git Graph: `Cmd/Ctrl+Shift+G`
- Architecture: `Cmd/Ctrl+Shift+A`

## AI Shortcuts

- Toggle Space: `Cmd/Ctrl+Shift+V`

Space must first be enabled in Settings -> General. It records a spoken
request and inserts its transcript into the terminal pane that was active when
recording started. It never presses Enter or runs the input automatically.

Users can customize these shortcuts from Settings -> Shortcuts. The new-tab menu
reflects custom bindings from the same registry.
