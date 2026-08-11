import { useCallback, useEffect, useRef, useState } from "react";

export const TERMINAL_LAZY_RESTORE_DELAY_MS = 90;

export type PaneHydrationArgs = {
  activeLeafId: number | null;
  renderLeafIds: number[];
  scopeKey: string | number | null;
};

export type PaneHydrationResult = {
  hydrateLeaf: (leafId: number) => void;
  isLeafHydrated: (leafId: number) => boolean;
};

type PaneHydrationSchedule = (callback: () => void) => () => void;

type PaneHydrationControllerOptions = PaneHydrationArgs & {
  onChange?: () => void;
  schedule?: PaneHydrationSchedule;
};

export type PaneHydrationController = {
  dispose: () => void;
  hydrateLeaf: (leafId: number) => void;
  isLeafHydrated: (leafId: number) => boolean;
  update: (next: PaneHydrationArgs) => void;
};

function getOwnerWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

export function scheduleIdlePaneRestore(callback: () => void): () => void {
  const ownerWindow = getOwnerWindow();
  if (!ownerWindow) return () => {};

  if (typeof ownerWindow.requestIdleCallback === "function") {
    const id = ownerWindow.requestIdleCallback(callback, {
      timeout: TERMINAL_LAZY_RESTORE_DELAY_MS * 3,
    });
    return () => ownerWindow.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(callback, TERMINAL_LAZY_RESTORE_DELAY_MS);
  return () => globalThis.clearTimeout(id);
}

function activeLeafSet(activeLeafId: number | null): Set<number> {
  return activeLeafId === null ? new Set<number>() : new Set([activeLeafId]);
}

export function createPaneHydrationController({
  activeLeafId: initialActiveLeafId,
  renderLeafIds: initialRenderLeafIds,
  scopeKey: initialScopeKey,
  onChange,
  schedule = scheduleIdlePaneRestore,
}: PaneHydrationControllerOptions): PaneHydrationController {
  let activeLeafId = initialActiveLeafId;
  let renderLeafIds = initialRenderLeafIds;
  let scopeKey = initialScopeKey;
  let renderLeafSignature = initialRenderLeafIds.join(",");
  let hydratedLeafIds = activeLeafSet(initialActiveLeafId);
  let disposed = false;
  let cancelPendingRestore: (() => void) | null = null;

  const notifyChange = () => {
    onChange?.();
  };

  const setHydratedLeafIds = (next: Set<number>) => {
    if (next === hydratedLeafIds) return;
    hydratedLeafIds = next;
    notifyChange();
  };

  const hydrateLeaf = (leafId: number) => {
    if (hydratedLeafIds.has(leafId)) return;
    const next = new Set(hydratedLeafIds);
    next.add(leafId);
    setHydratedLeafIds(next);
  };

  const nextRestorableLeaf = () =>
    renderLeafIds.find(
      (leafId) => leafId !== activeLeafId && !hydratedLeafIds.has(leafId),
    );

  const cancelRestoreQueue = () => {
    cancelPendingRestore?.();
    cancelPendingRestore = null;
  };

  const queueRestore = () => {
    cancelRestoreQueue();
    if (disposed || activeLeafId === null) return;

    const nextLeafId = nextRestorableLeaf();
    if (nextLeafId === undefined) return;

    let cancelled = false;
    let cancelScheduledStep: (() => void) | null = null;

    const restoreNext = () => {
      if (disposed || cancelled) return;

      const leafId = nextRestorableLeaf();
      if (leafId === undefined) {
        cancelScheduledStep = null;
        return;
      }

      hydrateLeaf(leafId);
      if (disposed || cancelled || nextRestorableLeaf() === undefined) {
        cancelScheduledStep = null;
        return;
      }

      cancelScheduledStep = schedule(restoreNext);
    };

    cancelScheduledStep = schedule(restoreNext);
    cancelPendingRestore = () => {
      cancelled = true;
      cancelScheduledStep?.();
      cancelScheduledStep = null;
    };
  };

  const resetHydration = () => {
    setHydratedLeafIds(activeLeafSet(activeLeafId));
  };

  const ensureActiveLeafHydrated = () => {
    if (activeLeafId === null || hydratedLeafIds.has(activeLeafId)) return;
    hydrateLeaf(activeLeafId);
  };

  queueRestore();

  return {
    dispose() {
      disposed = true;
      cancelRestoreQueue();
    },
    hydrateLeaf,
    isLeafHydrated(leafId: number) {
      return hydratedLeafIds.has(leafId);
    },
    update(next: PaneHydrationArgs) {
      const nextSignature = next.renderLeafIds.join(",");
      const scopeChanged =
        next.scopeKey !== scopeKey || nextSignature !== renderLeafSignature;
      const activeLeafChanged = next.activeLeafId !== activeLeafId;

      activeLeafId = next.activeLeafId;
      renderLeafIds = next.renderLeafIds;
      scopeKey = next.scopeKey;
      renderLeafSignature = nextSignature;

      if (scopeChanged) {
        resetHydration();
        queueRestore();
        return;
      }

      if (activeLeafChanged) {
        ensureActiveLeafHydrated();
        queueRestore();
      }
    },
  };
}

export function usePaneHydration({
  activeLeafId,
  renderLeafIds,
  scopeKey,
}: PaneHydrationArgs): PaneHydrationResult {
  const [, setVersion] = useState(0);
  const controllerRef = useRef<PaneHydrationController | null>(null);

  const handleChange = useCallback(() => {
    setVersion((version) => version + 1);
  }, []);

  if (!controllerRef.current) {
    controllerRef.current = createPaneHydrationController({
      activeLeafId,
      renderLeafIds,
      scopeKey,
      onChange: handleChange,
    });
  }

  useEffect(() => {
    controllerRef.current?.update({
      activeLeafId,
      renderLeafIds,
      scopeKey,
    });
  }, [activeLeafId, renderLeafIds, scopeKey]);

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const hydrateLeaf = useCallback((leafId: number) => {
    controllerRef.current?.hydrateLeaf(leafId);
  }, []);

  const isLeafHydrated = useCallback(
    (leafId: number) =>
      leafId === activeLeafId || controllerRef.current?.isLeafHydrated(leafId) === true,
    [activeLeafId],
  );

  return {
    hydrateLeaf,
    isLeafHydrated,
  };
}
