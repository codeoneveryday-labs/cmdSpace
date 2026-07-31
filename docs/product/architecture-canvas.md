# Architecture Canvas

The Architecture tab provides a drawable SVG canvas for system diagrams. Users can
drop C4-style nodes, drawing primitives, text, images, frames, lines, arrows, and
freehand pen strokes.

Rectangle and circle drawing primitives render as hollow outline shapes so the
canvas grid and connectors remain visible through their interiors.

## Drawing Connectors

Line and Arrow drawing tools create editable connector drawings. Selecting a line
or arrow reveals three handles:

- The start handle moves the tail.
- The middle handle bends the curve.
- The end handle moves the head.

The connector keeps its existing curve while either end is dragged. Arrow drawings
use the same connector editing behavior as lines, with an arrowhead rendered at
the end.

Connector endpoints snap to nearby canvas shapes. When a line or arrow endpoint
is drawn or dragged close to a shape boundary, it attaches to that shape and
continues to render on the shape boundary as the shape moves. Dragging the
endpoint away from nearby shapes detaches it back into a free endpoint.

The canvas supports trackpad gestures. Two-finger scroll pans the viewport in
place without switching to the pan tool. Pinch wheel gestures zoom around the
cursor position, while toolbar zoom buttons continue to zoom around the current
viewport center.

The pan tool moves the canvas in all directions. View bounds include slack around
the initial canvas so users can drag vertically, horizontally, or diagonally even
when the current viewport is as tall as the initial grid.
Canvas elements can also be dragged or created inside that visible pan slack, so
moving the viewport left or up does not create an invisible wall at the initial
canvas origin.

## Tool Shortcuts

When an Architecture tab is active and the user is not typing in a field, canvas
tools can be selected with single-key shortcuts:

- `V`: Select
- `H`: Pan / hand
- `C`: Connect
- `L`: Line
- `A`: Arrow
- `P`: Pen
- `T`: Text
- `I`: Image
- `F`: Frame
- `E`: Eraser
- `Esc`: Select
- `Delete` / `Backspace`: Delete the selected element

Pen is a top-toolbar-only tool, not a left-palette shape. It stays active after
each freehand stroke so users can draw multiple strokes without reselecting it.

Double-clicking empty canvas space creates a text label at that point and starts
inline editing immediately. Double-clicking an existing text label edits it
inline on the canvas. Text editing supports multiple lines, and text labels use
compact selection bounds with centered alignment by default. The text editor is
rendered as an HTML overlay above the SVG canvas so editing is not clipped by SVG
foreign object bounds. Text label bounds grow to fit longer lines and additional
line breaks while the user types or edits from the inspector.

Shift-clicking canvas elements toggles multi-selection. Dragging a selected
element in the multi-selection moves the selected group together, and Delete /
Backspace removes the selected group.

Dragging a text label onto or near a canvas element attaches the text to that
element. Moving the attached element moves the linked text label with it.

## Canvas Terminal Docking

Canvas terminals remain independent PTY sessions, but their visual layout can be
combined. Dropping one terminal on another terminal's header adds it as a tab.
Dropping it on the left, right, top, or bottom edge creates a split in that
direction. Dropping over the terminal body center or empty Canvas space keeps it
as a floating terminal.

Docking changes layout only. It does not restart the shell, discard terminal
output, or move the session into the standard terminal-pane session pool. Saved
Canvas workspaces persist node bounds, dock groups, split ratios, active tabs,
terminal CWDs, and launch commands in the durable workspace record. Reopening
the workspace restores that layout and recreates fresh shells at each terminal's
saved working directory.

Each canvas terminal header exposes the same folder and Git branch picker as a
standard terminal pane. Folder changes are sent to that node's own PTY; branch
changes use the shared Git guard and refresh event. The header Lock button pins
only the canvas layout (drag, resize, delete); it intentionally leaves terminal
input available, matching Cate's terminal pin behavior.

Canvas pan and zoom transform the terminal world layer instead of changing each
terminal's screen-space box. This keeps xterm's client dimensions stable during
camera gestures, so fitting and PTY resize only run for an actual terminal
resize.

Version 1 supports terminal-to-terminal docking only.

## Validation

Source tests protect the Architecture tab contract and verify that connector
drawings expose start, middle, and end handles.
