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

- Toggle Floating Voice Agent: `Cmd/Ctrl+Shift+V`

The voice control must first be enabled in Settings -> General. It records a
spoken request, refines it with the configured AI model, and inserts an
editable draft into the terminal pane that was active when recording started.
It never presses Enter or runs the draft automatically.

Users can customize these shortcuts from Settings -> Shortcuts. The new-tab menu
reflects custom bindings from the same registry.
