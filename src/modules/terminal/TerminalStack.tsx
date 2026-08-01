import type { Tab, TerminalTab } from "@/modules/tabs";
import type { SearchAddon } from "@xterm/addon-search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaneTreeView } from "./PaneTreeView";
import type { TerminalPaneHandle } from "./TerminalPane";
import {
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
  type PaneNode,
  type SplitDir,
} from "./lib/panes";

const TERMINAL_LAZY_RESTORE_DELAY_MS = 90;

type Props = {
  tabs: Tab[];
  activeId: number;
  /** Register/unregister handle by leaf id (not tab id). */
  registerHandle: (leafId: number, handle: TerminalPaneHandle | null) => void;
  onSearchReady: (leafId: number, addon: SearchAddon) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onExit: (leafId: number, code: number) => void;
  onCommand?: (leafId: number, cmd: string) => void;
  onFocusLeaf: (tabId: number, leafId: number) => void;
  onCloseLeaf: (leafId: number) => void;
  onToggleMaximize: (leafId: number) => void;
  onSplitPane: (dir: SplitDir) => void;
  focusAccentColor: string;
  onPaneTreeChange: (tabId: number, paneTree: PaneNode) => void;
};

type Bundle = {
  setRef: (h: TerminalPaneHandle | null) => void;
  getRef: () => TerminalPaneHandle | null;
  onSearch: (addon: SearchAddon) => void;
  onCwd: (cwd: string) => void;
  onExit: (code: number) => void;
  onCommand?: (cmd: string) => void;
};

function scheduleIdlePaneRestore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, {
      timeout: TERMINAL_LAZY_RESTORE_DELAY_MS * 3,
    });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, TERMINAL_LAZY_RESTORE_DELAY_MS);
  return () => globalThis.clearTimeout(id);
}

export function TerminalStack({
  tabs,
  activeId,
  registerHandle,
  onSearchReady,
  onCwd,
  onExit,
  onCommand,
  onFocusLeaf,
  onCloseLeaf,
  onToggleMaximize,
  onSplitPane,
  focusAccentColor,
  onPaneTreeChange,
}: Props) {
  const terminals = useMemo(
    () => tabs.filter((t) => t.kind === "terminal") as TerminalTab[],
    [tabs],
  );
  const activeTerminal = terminals.find((t) => t.id === activeId) ?? null;
  const nodeToRender = useMemo(() => {
    if (!activeTerminal) return null;
    const maximizedLeafId = activeTerminal.maximizedLeafId;
    if (maximizedLeafId === undefined) return activeTerminal.paneTree;
    return {
      kind: "leaf" as const,
      id: maximizedLeafId,
      cwd: findLeafCwd(activeTerminal.paneTree, maximizedLeafId),
      lastCommand: findLeafLastCommand(
        activeTerminal.paneTree,
        maximizedLeafId,
      ),
    };
  }, [activeTerminal]);
  const renderLeafIds = useMemo(
    () => (nodeToRender ? leafIds(nodeToRender) : []),
    [nodeToRender],
  );
  const renderLeafSignature = renderLeafIds.join(",");
  const [hydratedLeafIds, setHydratedLeafIds] = useState<Set<number>>(
    () => new Set(),
  );

  const registerRef = useRef(registerHandle);
  const searchReadyRef = useRef(onSearchReady);
  const cwdRef = useRef(onCwd);
  const exitRef = useRef(onExit);
  const commandRef = useRef(onCommand);
  useEffect(() => {
    registerRef.current = registerHandle;
  }, [registerHandle]);
  useEffect(() => {
    searchReadyRef.current = onSearchReady;
  }, [onSearchReady]);
  useEffect(() => {
    cwdRef.current = onCwd;
  }, [onCwd]);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);
  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  const bundles = useRef(new Map<number, Bundle>());
  const getBundle = (leafId: number): Bundle => {
    let b = bundles.current.get(leafId);
    if (!b) {
      let handle: TerminalPaneHandle | null = null;
      b = {
        setRef: (h) => {
          handle = h;
          registerRef.current(leafId, h);
        },
        getRef: () => handle,
        onSearch: (addon) => searchReadyRef.current(leafId, addon),
        onCwd: (cwd) => cwdRef.current(leafId, cwd),
        onExit: (code) => exitRef.current(leafId, code),
        onCommand: (cmd) => commandRef.current?.(leafId, cmd),
      };
      bundles.current.set(leafId, b);
    }
    return b;
  };

  useEffect(() => {
    const live = new Set<number>();
    for (const t of terminals) for (const id of leafIds(t.paneTree)) live.add(id);
    for (const id of bundles.current.keys()) {
      if (!live.has(id)) bundles.current.delete(id);
    }
  }, [terminals]);

  useEffect(() => {
    if (!activeTerminal) {
      setHydratedLeafIds(new Set());
      return;
    }
    setHydratedLeafIds(new Set([activeTerminal.activeLeafId]));
  }, [activeTerminal?.id, renderLeafSignature]);

  useEffect(() => {
    if (!activeTerminal) return;
    setHydratedLeafIds((current) => {
      if (current.has(activeTerminal.activeLeafId)) return current;
      const next = new Set(current);
      next.add(activeTerminal.activeLeafId);
      return next;
    });
  }, [activeTerminal?.id, activeTerminal?.activeLeafId]);

  useEffect(() => {
    if (!activeTerminal || renderLeafIds.length <= 1) return;

    let cancelled = false;
    let cancelPendingRestore: (() => void) | null = null;
    let index = 0;

    const restoreNext = () => {
      if (cancelled) return;

      while (
        index < renderLeafIds.length &&
        renderLeafIds[index] === activeTerminal.activeLeafId
      ) {
        index += 1;
      }
      if (index >= renderLeafIds.length) return;

      const leafId = renderLeafIds[index];
      index += 1;
      setHydratedLeafIds((current) => {
        if (current.has(leafId)) return current;
        const next = new Set(current);
        next.add(leafId);
        return next;
      });
      cancelPendingRestore = scheduleIdlePaneRestore(restoreNext);
    };

    cancelPendingRestore = scheduleIdlePaneRestore(restoreNext);
    return () => {
      cancelled = true;
      cancelPendingRestore?.();
    };
  }, [activeTerminal?.id, renderLeafSignature]);

  const hydrateLeaf = useCallback((leafId: number) => {
    setHydratedLeafIds((current) => {
      if (current.has(leafId)) return current;
      const next = new Set(current);
      next.add(leafId);
      return next;
    });
  }, []);

  const isLeafHydrated = useCallback(
    (leafId: number) =>
      leafId === activeTerminal?.activeLeafId || hydratedLeafIds.has(leafId),
    [activeTerminal?.activeLeafId, hydratedLeafIds],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      {activeTerminal && nodeToRender ? (
        <div key={activeTerminal.id} className="absolute inset-0">
          <PaneTreeView
            node={nodeToRender}
            tabVisible={true}
            activeLeafId={activeTerminal.activeLeafId}
            onFocusLeaf={(leafId) => onFocusLeaf(activeTerminal.id, leafId)}
            getBundle={getBundle}
            onCloseLeaf={onCloseLeaf}
            onToggleMaximize={onToggleMaximize}
            isMaximized={activeTerminal.maximizedLeafId !== undefined}
            canMaximize={leafIds(activeTerminal.paneTree).length > 1}
            onSplitPane={onSplitPane}
            focusAccentColor={focusAccentColor}
            isLeafHydrated={isLeafHydrated}
            onHydrateLeaf={hydrateLeaf}
            onPaneTreeChange={(paneTree) =>
              onPaneTreeChange(activeTerminal.id, paneTree)
            }
          />
        </div>
      ) : null}
    </div>
  );
}
