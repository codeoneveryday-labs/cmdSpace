import { cn } from "@/lib/utils";
import { isTauri } from "@tauri-apps/api/core";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExplorerSearch, type ExplorerSearchHandle } from "./ExplorerSearch";
import { FileExplorerHeader } from "./FileExplorerHeader";
import { InlineInput } from "./InlineInput";
import { FileExplorerRow } from "./FileExplorerRow";
import { copyToClipboard, revealInFinder } from "./lib/contextActions";
import { fileIconUrl, folderIconUrl } from "./lib/iconResolver";
import { useFileExplorerClipboard } from "./lib/useFileExplorerClipboard";
import { COMPACT_CONTENT, COMPACT_ITEM } from "./lib/menuItemClass";
import { useFileTree, type DeletedPath } from "./lib/useFileTree";
import { useGlobalShortcuts } from "@/modules/shortcuts";
import { buildRows, type Row } from "./lib/fileExplorerRows";
import { prepareMovePaths } from "./lib/fileMoveModel";
import { resolveDropDestination } from "./lib/fileDropModel";
import { useFileExplorerNativeDrop } from "./lib/useFileExplorerNativeDrop";
import { useFileExplorerKeyboard } from "./lib/useFileExplorerKeyboard";
import { useFileExplorerInternalDrag } from "./lib/useFileExplorerInternalDrag";
import { useFileExplorerSelection } from "./lib/useFileExplorerSelection";

export type FileExplorerHandle = {
  focus: () => void;
  isFocused: () => boolean;
};

type Props = {
  rootPath: string | null;
  acceptExternalDrops?: boolean;
  onOpenFile: (path: string, pin?: boolean) => void;
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
  onRevealInTerminal?: (path: string) => void;
  onOpenMarkdownPreview?: (path: string) => void;
};

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export const FileExplorer = forwardRef<FileExplorerHandle, Props>(
  function FileExplorer(
    {
      rootPath,
      acceptExternalDrops = false,
      onOpenFile,
      onPathRenamed,
      onPathDeleted,
      onRevealInTerminal,
      onOpenMarkdownPreview,
    },
    ref,
  ) {
    const [undoRecords, setUndoRecords] = useState<DeletedPath[]>([]);
    const handleDeleteCommitted = useCallback(
      (records: DeletedPath[]) => setUndoRecords(records),
      [],
    );
    const tree = useFileTree(rootPath, {
      onPathRenamed,
      onPathDeleted,
      onDeleteCommitted: handleDeleteCommitted,
    });
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [isDroppingFiles, setIsDroppingFiles] = useState(false);
    const searchRef = useRef<ExplorerSearchHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { rows, entryIndexByPath } = useMemo(() => {
      if (!rootPath) return { rows: [] as Row[], entryIndexByPath: new Map<string, number>() };
      return buildRows(rootPath, tree);
    }, [rootPath, tree.nodes, tree.expanded, tree.renaming, tree.pendingCreate, tree]);

    const entryPaths = useMemo<string[]>(() => {
      const out: string[] = [];
      for (const row of rows) if (row.kind === "entry") out.push(row.path);
      return out;
    }, [rows]);

    const {
      selectedPaths,
      selectedPathSet,
      focusedPath,
      selectPath,
      clearSelection,
    } = useFileExplorerSelection({ rootPath, entryPaths, entryIndexByPath });
    useEffect(() => {
      setUndoRecords([]);
    }, [rootPath]);
    const entryByPath = useMemo(() => {
      const entries = new Map<string, Extract<Row, { kind: "entry" }>>();
      for (const row of rows) {
        if (row.kind === "entry") entries.set(row.path, row);
      }
      return entries;
    }, [rows]);
    const undoDelete = useCallback(async () => {
      if (undoRecords.length === 0) return;
      await tree.restorePaths(undoRecords);
      setUndoRecords([]);
    }, [tree, undoRecords]);

    const deleteSelected = useCallback(async () => {
      if (selectedPaths.length === 0) return;
      const count = selectedPaths.length;
      if (!window.confirm(`Delete ${count} selected item${count === 1 ? "" : "s"}?`)) return;
      await tree.deletePaths(selectedPaths);
      clearSelection();
    }, [clearSelection, selectedPaths, tree]);

    const dropDestination = useCallback(
      (targetPath?: string, targetIsDir?: boolean) =>
        resolveDropDestination(
          targetPath,
          targetIsDir,
          focusedPath,
          entryByPath,
          rootPath,
        ),
      [entryByPath, focusedPath, rootPath],
    );

    const importBrowserFiles = useCallback(
      async (files: File[], destination: string) => {
        for (const file of files) {
          await tree.importClipboardFile(
            file.name || "pasted-file",
            await fileToBase64(file),
            destination,
          );
        }
      },
      [tree],
    );

    const movePaths = useCallback(
      (paths: string[], targetPath: string, targetIsDir: boolean) => {
        const destination = dropDestination(targetPath, targetIsDir);
        const sources = prepareMovePaths(paths, destination);
        if (!sources) return;
        void tree.movePaths(sources, destination).catch((error) => {
          console.error("move files failed:", error);
        });
      },
      [dropDestination, tree],
    );

    const {
      dropTarget: internalDropTarget,
      handleDragMove: handleInternalDragMove,
      handleDragEnd: handleInternalDragEnd,
      clearDropTarget: clearInternalDropTarget,
    } = useFileExplorerInternalDrag({
      scrollRef,
      rootPath,
      resolveDestination: dropDestination,
      movePaths,
    });

    useFileExplorerNativeDrop({
      acceptExternalDrops,
      scrollRef,
      onDroppingChange: setIsDroppingFiles,
      resolveDestination: dropDestination,
      importPaths: tree.importPaths,
    });

    const { handleCopy, handlePaste } = useFileExplorerClipboard({
      selectedPaths,
      resolveDestination: () => dropDestination(),
      importPaths: tree.importPaths,
      importBrowserFiles,
    });

    const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: OVERSCAN,
      getItemKey: (index) => rows[index]?.key ?? index,
    });

    const scrollEntryIntoView = useCallback(
      (path: string) => {
        const index = entryIndexByPath.get(path);
        if (index === undefined) return;
        virtualizer.scrollToIndex(index, { align: "auto" });
      },
      [entryIndexByPath, virtualizer],
    );

    const handleKeyDown = useFileExplorerKeyboard({
      tree,
      isSearchOpen,
      focusedPath,
      entryPaths,
      rows,
      rootPath: rootPath ?? "",
      selectedCount: selectedPaths.length,
      onUndoDelete: () => void undoDelete(),
      onClearSelection: clearSelection,
      onDeleteSelected: () => void deleteSelected(),
      onOpenFile,
      onSelectPath: selectPath,
      onScrollEntryIntoView: scrollEntryIntoView,
    });

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          containerRef.current?.focus();
          if (!focusedPath && entryPaths.length > 0) {
            const first = entryPaths[0];
            selectPath(first, false);
            requestAnimationFrame(() => scrollEntryIntoView(first));
          }
        },
        isFocused: () => {
          const c = containerRef.current;
          if (!c) return false;
          const active = document.activeElement;
          return active instanceof Node && c.contains(active);
        },
      }),
      [entryPaths, focusedPath, scrollEntryIntoView, selectPath],
    );

    useGlobalShortcuts({
      "explorer.search": () => {
        if (searchRef.current?.isFocused()) {
          setIsSearchOpen(false);
          return;
        }
        setIsSearchOpen(true);
        searchRef.current?.focus();
      },
    });

    if (!rootPath) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <HugeiconsIcon
            icon={Folder01Icon}
            size={24}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
          <div className="text-xs text-muted-foreground">
            No current directory
          </div>
        </div>
      );
    }

    const root = tree.nodes[rootPath];
    const pendingAtRoot =
      tree.pendingCreate?.parentPath === rootPath ? tree.pendingCreate : null;

    return (
      <div
        ref={containerRef}
        className="flex h-full flex-col outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
      >
        <FileExplorerHeader
          rootPath={rootPath}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          onCreateFile={() => tree.beginCreate(rootPath, "file")}
          onCreateFolder={() => tree.beginCreate(rootPath, "dir")}
          onRefresh={() => tree.refresh(rootPath)}
        />

        <ExplorerSearch
          ref={searchRef}
          rootPath={rootPath}
          onOpenFile={onOpenFile}
          open={isSearchOpen}
          onRequestClose={() => setIsSearchOpen(false)}
          onActiveChange={setIsSearchActive}
          onRevealInTerminal={onRevealInTerminal}
        />

        {!isSearchActive ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={scrollRef}
                className={cn(
                  "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
                  isDroppingFiles && "bg-accent/50 ring-1 ring-inset ring-primary/50",
                  internalDropTarget?.path === rootPath &&
                    "bg-primary/10 ring-1 ring-inset ring-primary/40",
                )}
                onClick={(event) => {
                  if (event.target === event.currentTarget) clearSelection();
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.files.length === 0) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setIsDroppingFiles(true);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                  setIsDroppingFiles(false);
                }}
                onDrop={(event) => {
                  setIsDroppingFiles(false);
                  const target = (event.target as HTMLElement).closest<HTMLElement>(
                    "[data-fs-path]",
                  );
                  const files = Array.from(event.dataTransfer.files);
                  if (files.length === 0) return;
                  event.preventDefault();
                  if (isTauri()) return;
                  void importBrowserFiles(
                    files,
                    dropDestination(
                      target?.dataset.fsPath,
                      target?.dataset.fsIsDir === "true",
                    ),
                  ).catch((error) => {
                    console.error("import browser files failed:", error);
                  });
                }}
              >
                {pendingAtRoot ? (
                  <div
                    className="flex h-6 w-full min-w-0 items-center gap-2 px-1.5 text-[13px]"
                    style={{ paddingLeft: 6 }}
                  >
                    <span className="size-3.5 shrink-0" />
                    <img
                      src={
                        pendingAtRoot.kind === "dir"
                          ? folderIconUrl("", false)
                          : fileIconUrl("untitled")
                      }
                      alt=""
                      className="size-4 shrink-0 opacity-70"
                    />
                    <InlineInput
                      initial=""
                      placeholder={
                        pendingAtRoot.kind === "dir" ? "New folder" : "New file"
                      }
                      onCommit={tree.commitCreate}
                      onCancel={tree.cancelCreate}
                    />
                  </div>
                ) : null}
                {root?.status === "loading" && (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground">
                    Loading…
                  </div>
                )}
                {root?.status === "error" && (
                  <div className="px-3 py-2 text-[11px] text-destructive">
                    {root.message}
                  </div>
                )}
                {root?.status === "loaded" ? (
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index];
                      if (!row) return null;
                      return (
                        <div
                          key={virtualRow.key}
                          data-virtual-row-index={virtualRow.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: virtualRow.size,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <FileExplorerRow
                            row={row}
                            rootPath={rootPath}
                            tree={tree}
                            selectedPathSet={selectedPathSet}
                            selectedPaths={selectedPaths}
                            onOpenFile={onOpenFile}
                            onSelectPath={selectPath}
                            onRevealInTerminal={onRevealInTerminal}
                            onOpenMarkdownPreview={onOpenMarkdownPreview}
                            dropTargetPath={internalDropTarget?.path ?? null}
                            onInternalDragMove={handleInternalDragMove}
                            onInternalDragEnd={handleInternalDragEnd}
                            onInternalDragCancel={clearInternalDropTarget}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent
              className={COMPACT_CONTENT}
              onCloseAutoFocus={(e) => {
                if (tree.renaming || tree.pendingCreate) e.preventDefault();
              }}
            >
              {onRevealInTerminal && (
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => onRevealInTerminal(rootPath)}
                >
                  Open in Terminal
                </ContextMenuItem>
              )}
              <ContextMenuItem
                className={COMPACT_ITEM}
                onSelect={() => void revealInFinder(rootPath)}
              >
                Reveal in Finder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className={COMPACT_ITEM}
                onSelect={() => tree.beginCreate(rootPath, "file")}
              >
                New File
              </ContextMenuItem>
              <ContextMenuItem
                className={COMPACT_ITEM}
                onSelect={() => tree.beginCreate(rootPath, "dir")}
              >
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className={COMPACT_ITEM}
                onSelect={() => void copyToClipboard(rootPath)}
              >
                Copy Path
              </ContextMenuItem>
              <ContextMenuItem
                className={COMPACT_ITEM}
                onSelect={() => tree.refresh(rootPath)}
              >
                Refresh
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : null}
      </div>
    );
  },
);
