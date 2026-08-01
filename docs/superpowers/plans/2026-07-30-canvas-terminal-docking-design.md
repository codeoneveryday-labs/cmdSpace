# Canvas Terminal Docking Design

## Goal

Allow independent Canvas terminals to merge without restarting their PTYs:

- Drop on a terminal header to add the source terminal as a tab.
- Drop on the left, right, top, or bottom edge to create a split.
- Drag a docked terminal away from a group to make it floating again.
- Preserve the existing independent Canvas PTY lifecycle, CWD tracking, agent
  command startup, close behavior, and saved-canvas restoration.

Version 1 only docks terminal nodes with other terminal nodes.

## Reference behavior

The interaction follows Cate's mini-dock behavior:

- The first 38 screen pixels of a target stack are the tab drop band.
- Split bands use 12% of the target width or height, capped at 60 screen pixels.
- The target body center is not a dock target; dropping there remains a free
  Canvas move.
- Split previews cover the exact half where the source will land.
- Tab previews mark the header instead of covering terminal output.

## Architecture

### Persisted dock tree

`ArchitectureDiagram` gains an optional `terminalDockGroups` property. A group
owns the outer Canvas bounds and a recursive layout tree:

```ts
type ArchitectureTerminalDockTabs = {
  id: string;
  kind: "tabs";
  terminalIds: string[];
  activeTerminalId: string;
};

type ArchitectureTerminalDockSplit = {
  id: string;
  kind: "split";
  direction: "horizontal" | "vertical";
  ratio: number;
  first: ArchitectureTerminalDockNode;
  second: ArchitectureTerminalDockNode;
};

type ArchitectureTerminalDockGroup = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  root: ArchitectureTerminalDockNode;
};
```

`horizontal` places children left/right. `vertical` places children top/bottom.
The initial ratio is `0.5`.

Old diagrams need no migration step. During normalization, each terminal not
referenced by a valid saved group receives a single-tab group using its existing
node bounds. Invalid terminal IDs, duplicate membership, empty tab stacks, and
invalid split nodes are removed or collapsed.

### Stable PTY ownership

Terminal React elements remain one flat sibling list keyed by terminal node ID.
Docking changes only their computed rectangle, visibility, and header metadata.
It never changes their React key or reparents them into a different group
component.

Inactive tabs use CSS visibility/pointer-event state rather than conditional
rendering, so their `CanvasTerminalNode` instances remain mounted. Consequently:

- `openPty` runs once per terminal instance.
- Tab and split operations do not call `session.close`.
- Deleting the terminal still unmounts it and closes the PTY.
- Reopening the saved Canvas still creates a new shell at the saved CWD, as
  before.

This keeps Canvas terminal sessions separate from `TerminalPane` and its shared
renderer/session pool.

### Pure layout and mutation module

`terminalDockLayout.ts` owns pure operations:

- Normalize persisted groups against the current terminal node IDs.
- Resolve tab-stack rectangles from the recursive tree.
- Hit-test a pointer into tab/split/free-move targets.
- Activate a tab.
- Remove, dock, detach, and delete a terminal while collapsing empty branches.
- Move or resize a single-terminal group.

Keeping these operations outside `ArchitectureCanvas.tsx` gives the complex
tree behavior direct unit coverage and keeps the Canvas component focused on
pointer orchestration.

### Drag lifecycle

At drag start, the source terminal's rendered leaf rectangle is frozen in the
drag state. Pointer movement produces:

1. A free-moving source ghost.
2. The smallest visible target stack under the pointer, excluding invalid
   single-terminal self-drops.
3. Either:
   - a tab-header preview,
   - a half-stack split preview, or
   - no dock preview.

At pointer release:

- Tab target: remove source from its old stack, collapse the old tree, append it
  to the target stack, and make it active.
- Split target: remove source, replace the target stack with a 50/50 split, and
  put source on the requested side.
- No dock target: detach source into a new single-terminal group at the ghost
  bounds. If it was already alone, move its existing group.

The target group's outer bounds remain unchanged after docking.

### Header and split rendering

Each visible stack renders one terminal viewport. Its header receives the stack's
tab list:

- Clicking a tab activates it without starting a drag.
- Dragging the active tab/header starts a terminal drag.
- Existing maximize and close actions remain available.

The layout renderer leaves a small divider gap between split children. Terminal
viewport overflow stays clipped, and the existing `ResizeObserver`/`FitAddon`
path refits xterm whenever its leaf rectangle changes.

### Canvas integration

- History snapshots include dock groups, so Undo reverses tab, split, detach,
  move, resize, and delete operations.
- `onDiagramChange` persists nodes, edges, and dock groups together.
- Closing, Delete/Backspace, and clear-canvas remove terminal IDs from the dock
  tree before the React terminal unmounts.
- New terminal placement creates both a terminal node and a single-tab group.
- Existing frame attachment remains node-based; docking copies the target
  terminal's frame association to the source terminal.

## Visual feedback

- Split: blue 12% translucent half overlay with a solid blue border.
- Tab: blue header outline and a compact `+ Tab` insertion hint.
- Free move: retain the current floating terminal ghost.
- Motion uses opacity/transform only and respects reduced-motion preferences.

## Error handling and compatibility

- Corrupt saved groups never prevent the Canvas from opening.
- Every valid terminal appears exactly once after normalization.
- Groups that reference missing terminals are pruned.
- A split with one valid child collapses to that child.
- A tab stack always has a valid active terminal fallback.
- Legacy image data and non-terminal diagram nodes are unaffected.

## Verification

- Pure unit tests cover normalization, geometry, all five drop outcomes, same
  group moves, cross-group moves, detach, delete, and branch collapse.
- Render/source tests prove dock metadata reaches terminal headers and inactive
  tabs stay mounted.
- Existing architecture, terminal, Canvas rendering, TypeScript, and production
  build checks remain green.

