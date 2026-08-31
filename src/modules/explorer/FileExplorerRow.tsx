import { EntryRow, PendingRow, StatusRow } from "./TreeRow";
import type { Row } from "./lib/fileExplorerRows";
import type { useFileTree } from "./lib/useFileTree";

type Tree = ReturnType<typeof useFileTree>;

export function FileExplorerRow({
  row,
  rootPath,
  tree,
  selectedPathSet,
  selectedPaths,
  onOpenFile,
  onSelectPath,
  onRevealInTerminal,
  onOpenMarkdownPreview,
  dropTargetPath,
  onInternalDragMove,
  onInternalDragEnd,
  onInternalDragCancel,
}: {
  row: Row;
  rootPath: string;
  tree: Tree;
  selectedPathSet: ReadonlySet<string>;
  selectedPaths: string[];
  onOpenFile: (path: string, pin?: boolean) => void;
  onSelectPath: (path: string, extend: boolean) => void;
  onRevealInTerminal?: (path: string) => void;
  onOpenMarkdownPreview?: (path: string) => void;
  dropTargetPath: string | null;
  onInternalDragMove: (paths: string[], clientX: number, clientY: number) => void;
  onInternalDragEnd: (paths: string[], clientX: number, clientY: number) => void;
  onInternalDragCancel: () => void;
}) {
  switch (row.kind) {
    case "entry":
    case "rename":
      return (
        <EntryRow
          path={row.path}
          name={row.name}
          isDir={row.isDir}
          isExpanded={row.kind === "entry" ? row.isExpanded : false}
          depth={row.depth}
          rootPath={rootPath}
          tree={tree}
          isSelected={selectedPathSet.has(row.path)}
          isRenaming={row.kind === "rename"}
          onOpenFile={onOpenFile}
          onSelectPath={onSelectPath}
          onRevealInTerminal={onRevealInTerminal}
          onOpenMarkdownPreview={onOpenMarkdownPreview}
          dragPaths={selectedPathSet.has(row.path) ? selectedPaths : [row.path]}
          isDropTarget={dropTargetPath === row.path}
          onInternalDragMove={onInternalDragMove}
          onInternalDragEnd={onInternalDragEnd}
          onInternalDragCancel={onInternalDragCancel}
        />
      );
    case "pending":
      return (
        <PendingRow
          depth={row.depth}
          kind={row.pendingKind}
          onCommit={tree.commitCreate}
          onCancel={tree.cancelCreate}
        />
      );
    case "status":
      return <StatusRow depth={row.depth} message={row.message} tone={row.tone} />;
  }
}
