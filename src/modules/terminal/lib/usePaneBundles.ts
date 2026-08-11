import type { SearchAddon } from "@xterm/addon-search";
import { useEffect, useRef } from "react";

import type { TerminalPaneHandle } from "@/modules/terminal/TerminalPane";
import type { TerminalTab } from "@/modules/tabs";

import { leafIds } from "./panes";

export type PaneBundle = {
  setRef: (handle: TerminalPaneHandle | null) => void;
  getRef: () => TerminalPaneHandle | null;
  onSearch: (addon: SearchAddon) => void;
  onCwd: (cwd: string) => void;
  onExit: (code: number) => void;
  onCommand?: (cmd: string) => void;
};

export type PaneBundleCallbacks = {
  registerHandle: (leafId: number, handle: TerminalPaneHandle | null) => void;
  onSearchReady: (leafId: number, addon: SearchAddon) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onExit: (leafId: number, code: number) => void;
  onCommand?: (leafId: number, cmd: string) => void;
};

export type PaneBundleRegistry = {
  getBundle: (leafId: number) => PaneBundle;
  updateCallbacks: (callbacks: PaneBundleCallbacks) => void;
  prune: (terminals: TerminalTab[]) => void;
};

export function createPaneBundles(
  initialCallbacks: PaneBundleCallbacks,
): PaneBundleRegistry {
  const callbacksRef = { current: initialCallbacks };
  const bundles = new Map<number, PaneBundle>();

  const getBundle = (leafId: number): PaneBundle => {
    let bundle = bundles.get(leafId);
    if (!bundle) {
      let handle: TerminalPaneHandle | null = null;
      bundle = {
        setRef: (nextHandle) => {
          handle = nextHandle;
          callbacksRef.current.registerHandle(leafId, nextHandle);
        },
        getRef: () => handle,
        onSearch: (addon) => callbacksRef.current.onSearchReady(leafId, addon),
        onCwd: (cwd) => callbacksRef.current.onCwd(leafId, cwd),
        onExit: (code) => callbacksRef.current.onExit(leafId, code),
        onCommand: (cmd) => callbacksRef.current.onCommand?.(leafId, cmd),
      };
      bundles.set(leafId, bundle);
    }
    return bundle;
  };

  return {
    getBundle,
    updateCallbacks(callbacks) {
      callbacksRef.current = callbacks;
    },
    prune(terminals) {
      const liveLeafIds = new Set<number>();
      for (const terminal of terminals) {
        for (const leafId of leafIds(terminal.paneTree)) liveLeafIds.add(leafId);
      }
      for (const leafId of bundles.keys()) {
        if (!liveLeafIds.has(leafId)) bundles.delete(leafId);
      }
    },
  };
}

type UsePaneBundlesArgs = PaneBundleCallbacks & {
  terminals: TerminalTab[];
};

export function usePaneBundles({
  terminals,
  registerHandle,
  onSearchReady,
  onCwd,
  onExit,
  onCommand,
}: UsePaneBundlesArgs) {
  const registryRef = useRef<PaneBundleRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = createPaneBundles({
      registerHandle,
      onSearchReady,
      onCwd,
      onExit,
      onCommand,
    });
  } else {
    registryRef.current.updateCallbacks({
      registerHandle,
      onSearchReady,
      onCwd,
      onExit,
      onCommand,
    });
  }

  useEffect(() => {
    registryRef.current?.prune(terminals);
  }, [terminals]);

  return {
    getBundle: registryRef.current.getBundle,
  };
}
