import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  FileAddIcon,
  Folder01Icon,
  FolderAddIcon,
  Refresh01Icon,
  Search01Icon,
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
import {
  EntryRow,
  INTERNAL_PATHS_MIME,
  PendingRow,
  StatusRow,
} from "./TreeRow";
import { InlineInput } from "./InlineInput";
import { copyToClipboard, revealInFinder } from "./lib/contextActions";
import { fileIconUrl, folderIconUrl } from "./lib/iconResolver";
import { COMPACT_CONTENT, COMPACT_ITEM } from "./lib/menuItemClass";
import { dirname, useFileTree, type DeletedPath } from "./lib/useFileTree";
import { canMovePathsTo, getSelectionRange, removeDescendants } from "./lib/selection";
import { useGlobalShortcuts } from "@/modules/shortcuts";

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
  onAttachToAgent?: (path: string) => void;
  onOpenMarkdownPreview?: (path: string) => void;
};

type Row =
  | {
      kind: "entry";
      key: string;
      path: string;
      name: string;
      isDir: boolean;
      isExpanded: boolean;
      depth: number;
    }
  | { kind: "rename"; key: string; path: string; name: string; isDir: boolean; depth: number }
  | { kind: "pending"; key: string; depth: number; pendingKind: "file" | "dir" }
  | { kind: "status"; key: string; depth: number; tone: "muted" | "error"; message: string };

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.isContentEditable ||
      element?.closest("input, textarea, [contenteditable=true]"),
  );
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function parseDraggedPaths(serialized: string): string[] {
  if (!serialized) return [];
  try {
    const paths = JSON.parse(serialized) as unknown;
    return Array.isArray(paths) &&
      paths.every((candidate) => typeof candidate === "string")
      ? paths
      : [];
  } catch {
    return [];
  }
}

function buildRows(
  rootPath: string,
  tree: ReturnType<typeof useFileTree>,
): { rows: Row[]; entryIndexByPath: Map<string, number> } {
  const rows: Row[] = [];
  const entryIndexByPath = new Map<string, number>();

  const walk = (parent: string, depth: number) => {
    const node = tree.nodes[parent];
    if (!node || node.status !== "loaded") return;
    for (const entry of node.entries) {
      const path = tree.joinPath(parent, entry.name);
      const isDir = entry.kind === "dir";
      const expanded = isDir && tree.expanded.has(path);
      const isRenaming = tree.renaming === path;
      if (isRenaming) {
        rows.push({
          kind: "rename",
          key: `rename:${path}`,
          path,
          name: entry.name,
          isDir,
          depth,
        });
      } else {
        entryIndexByPath.set(path, rows.length);
        rows.push({
          kind: "entry",
          key: path,
          path,
          name: entry.name,
          isDir,
          isExpanded: expanded,
          depth,
        });
      }
      if (isDir && expanded) {
        const child = tree.nodes[path];
        if (tree.pendingCreate?.parentPath === path) {
          rows.push({
            kind: "pending",
            key: `pending:${path}`,
            depth: depth + 1,
            pendingKind: tree.pendingCreate.kind,
          });
        }
        if (child?.status === "loading") {
          rows.push({
            kind: "status",
            key: `loading:${path}`,
            depth: depth + 1,
            tone: "muted",
            message: "Loading…",
          });
        } else if (child?.status === "error") {
          rows.push({
            kind: "status",
            key: `error:${path}`,
            depth: depth + 1,
            tone: "error",
            message: child.message,
          });
        } else if (child?.status === "loaded") {
          walk(path, depth + 1);
        }
      }
    }
  };

  walk(rootPath, 0);
  return { rows, entryIndexByPath };
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
      onAttachToAgent,
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
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
    const [focusedPath, setFocusedPath] = useState<string | null>(null);
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

    useEffect(() => {
      setSelectedPaths((current) => {
        const next = current.filter((path) => entryIndexByPath.has(path));
        return next.length === current.length ? current : next;
      });
      if (focusedPath && !entryIndexByPath.has(focusedPath)) {
        setFocusedPath(null);
      }
    }, [entryIndexByPath, focusedPath]);

    useEffect(() => {
      setSelectedPaths([]);
      setSelectionAnchor(null);
      setFocusedPath(null);
      setUndoRecords([]);
    }, [rootPath]);

    const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
    const entryByPath = useMemo(() => {
      const entries = new Map<string, Extract<Row, { kind: "entry" }>>();
      for (const row of rows) {
        if (row.kind === "entry") entries.set(row.path, row);
      }
      return entries;
    }, [rows]);
    const selectPath = useCallback(
      (path: string, extend: boolean) => {
        if (extend && selectionAnchor && entryPaths.includes(selectionAnchor)) {
          setSelectedPaths(getSelectionRange(entryPaths, selectionAnchor, path));
        } else {
          setSelectedPaths([path]);
          setSelectionAnchor(path);
        }
        setFocusedPath(path);
      },
      [entryPaths, selectionAnchor],
    );

    const clearSelection = useCallback(() => {
      setSelectedPaths([]);
      setSelectionAnchor(null);
      setFocusedPath(null);
    }, []);

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
      (targetPath?: string, targetIsDir?: boolean) => {
        if (targetPath) return targetIsDir ? targetPath : dirname(targetPath);
        if (focusedPath) {
          const entry = entryByPath.get(focusedPath);
          if (entry) return entry.isDir ? entry.path : dirname(entry.path);
        }
        return rootPath ?? "";
      },
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
        const sources = removeDescendants(paths);
        if (!canMovePathsTo(sources, destination)) return;
        void tree.movePaths(sources, destination).catch((error) => {
          console.error("move files failed:", error);
        });
      },
      [dropDestination, tree],
    );

    useEffect(() => {
      if (!isTauri()) return;
      const appWindow = getCurrentWindow();
      const appWebview = getCurrentWebview();
      let disposed = false;
      let unlisten: (() => void) | undefined;
      void (async () => {
        const scaleFactor = await appWindow.scaleFactor();
        if (disposed) return;
        const stop = await appWebview.onDragDropEvent(({ payload }) => {
          if (disposed) return;
          if (payload.type === "leave") {
            setIsDroppingFiles(false);
            return;
          }
          const position = payload.position.toLogical(scaleFactor);
          const pointTarget = document.elementFromPoint(position.x, position.y);
          const rect = scrollRef.current?.getBoundingClientRect();
          const overExplorer = Boolean(
            rect &&
              position.x >= rect.left &&
              position.x <= rect.right &&
              position.y >= rect.top &&
              position.y <= rect.bottom,
          );
          const overEditor = Boolean(
            acceptExternalDrops &&
              pointTarget?.closest("[data-editor-file-drop-region]"),
          );
          setIsDroppingFiles(overExplorer);
          if (payload.type !== "drop" || !(overExplorer || overEditor)) return;

          setIsDroppingFiles(false);
          const target = overExplorer
            ? pointTarget?.closest<HTMLElement>("[data-fs-path]")
            : null;
          const destination = dropDestination(
            target?.dataset.fsPath,
            target?.dataset.fsIsDir === "true",
          );
          void tree.importPaths(payload.paths, destination).catch((error) => {
            console.error("import dropped paths failed:", error);
          });
        });
        if (disposed) stop();
        else unlisten = stop;
      })().catch((error) => {
        console.error("register native file drop failed:", error);
      });
      return () => {
        disposed = true;
        unlisten?.();
      };
    }, [acceptExternalDrops, dropDestination, tree.importPaths]);

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (tree.renaming || tree.pendingCreate || isSearchOpen) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        void undoDelete();
        return;
      }
      if (entryPaths.length === 0) return;

      const currentIdx = focusedPath ? entryPaths.indexOf(focusedPath) : -1;
      const move = (next: number, extend: boolean) => {
        const clamped = Math.max(0, Math.min(entryPaths.length - 1, next));
        const path = entryPaths[clamped];
        selectPath(path, extend);
        requestAnimationFrame(() => scrollEntryIntoView(path));
      };

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(currentIdx < 0 ? 0 : currentIdx + 1, e.shiftKey);
          break;
        case "ArrowUp":
          e.preventDefault();
          move(currentIdx < 0 ? entryPaths.length - 1 : currentIdx - 1, e.shiftKey);
          break;
        case "ArrowRight": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir) {
            if (!row.isExpanded) tree.toggle(row.path);
            else move(currentIdx + 1, e.shiftKey);
          }
          break;
        }
        case "ArrowLeft": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir && row.isExpanded) {
            tree.toggle(row.path);
          } else {
            const parent = row.path.slice(0, row.path.lastIndexOf("/"));
            if (parent && parent !== rootPath) selectPath(parent, false);
          }
          break;
        }
        case "Enter": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir) tree.toggle(row.path);
          else onOpenFile(row.path);
          break;
        }
        case "Delete":
          if (selectedPaths.length > 0) {
            e.preventDefault();
            void deleteSelected();
          }
          break;
      }
    };

    const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target) || selectedPaths.length === 0) return;
      const paths = removeDescendants(selectedPaths);
      event.preventDefault();
      event.clipboardData.setData(INTERNAL_PATHS_MIME, JSON.stringify(paths));
      event.clipboardData.setData("text/plain", paths.join("\n"));
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return;
      const internalPaths = parseDraggedPaths(
        event.clipboardData.getData(INTERNAL_PATHS_MIME),
      );
      if (internalPaths.length > 0) {
        event.preventDefault();
        void tree.importPaths(internalPaths, dropDestination()).catch((error) => {
          console.error("copy files failed:", error);
        });
        return;
      }
      const files = Array.from(event.clipboardData.files);
      if (files.length > 0) {
        event.preventDefault();
        void importBrowserFiles(files, dropDestination()).catch((error) => {
          console.error("paste files failed:", error);
        });
        return;
      }
      if (!isTauri()) return;
      event.preventDefault();
      const destination = dropDestination();
      void invoke<string[]>("fs_clipboard_paths")
        .then((paths) => {
          if (paths.length === 0) return;
          return tree.importPaths(paths, destination);
        })
        .catch((error) => {
          console.error("paste native files failed:", error);
        });
    };

    const renderRow = (row: Row) => {
      switch (row.kind) {
        case "entry":
        case "rename": {
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
              onSelectPath={selectPath}
              onRevealInTerminal={onRevealInTerminal}
              onAttachToAgent={onAttachToAgent}
              onOpenMarkdownPreview={onOpenMarkdownPreview}
              dragPaths={selectedPathSet.has(row.path) ? selectedPaths : [row.path]}
              onMovePaths={movePaths}
            />
          );
        }
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
          return (
            <StatusRow depth={row.depth} message={row.message} tone={row.tone} />
          );
      }
    };

    return (
      <div
        ref={containerRef}
        className="flex h-full flex-col outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
      >
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2">
          <span
            className="flex flex-1 items-center truncate text-xs font-medium text-foreground/80"
            title={rootPath}
          >
            <img
              src={folderIconUrl(basename(rootPath), false)}
              alt=""
              height={15}
              width={15}
              className="mx-1.5"
            />
            {basename(rootPath)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setIsSearchOpen((v) => !v)}
            title="Search files"
            aria-label="Search files"
          >
            <HugeiconsIcon icon={Search01Icon} size={13} strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => tree.beginCreate(rootPath, "file")}
            title="New file"
          >
            <HugeiconsIcon icon={FileAddIcon} size={13} strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => tree.beginCreate(rootPath, "dir")}
            title="New folder"
          >
            <HugeiconsIcon icon={FolderAddIcon} size={13} strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => tree.refresh(rootPath)}
            title="Refresh"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={12} strokeWidth={2} />
          </Button>
        </div>

        <ExplorerSearch
          ref={searchRef}
          rootPath={rootPath}
          onOpenFile={onOpenFile}
          open={isSearchOpen}
          onRequestClose={() => setIsSearchOpen(false)}
          onActiveChange={setIsSearchActive}
          onRevealInTerminal={onRevealInTerminal}
          onAttachToAgent={onAttachToAgent}
        />

        {!isSearchActive ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={scrollRef}
                className={cn(
                  "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
                  isDroppingFiles && "bg-accent/50 ring-1 ring-inset ring-primary/50",
                )}
                onClick={(event) => {
                  if (event.target === event.currentTarget) clearSelection();
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(INTERNAL_PATHS_MIME)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    return;
                  }
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
                  const serialized = event.dataTransfer.getData(INTERNAL_PATHS_MIME);
                  const target = (event.target as HTMLElement).closest<HTMLElement>(
                    "[data-fs-path]",
                  );
                  if (serialized && !target) {
                    event.preventDefault();
                    const paths = parseDraggedPaths(serialized);
                    if (paths.length > 0) movePaths(paths, rootPath, true);
                    return;
                  }
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
                          {renderRow(row)}
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
