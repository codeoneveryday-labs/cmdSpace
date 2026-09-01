import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TrayTerminal, TrayWorkspace } from "./workspaces";

type TrayPane = {
  paneIndex: number;
  lastCommand?: string | null;
  autoLaunch?: boolean;
};

export function useTrayWorkspaceData() {
  const [workspaces, setWorkspaces] = useState<TrayWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<TrayWorkspace[]>("db_list_workspaces");
      const hydrated = await Promise.all(
        next.map(async (workspace) => ({
          ...workspace,
          terminals: await loadTrayTerminals(workspace),
        })),
      );
      setWorkspaces(hydrated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  return { workspaces, loading, error, refresh };
}

async function loadTrayTerminals(workspace: TrayWorkspace): Promise<TrayTerminal[]> {
  if (workspace.workspaceMode === "agent") return [{ label: "Agent chat" }];

  if (workspace.workspaceMode === "canvas" && workspace.paneLayout) {
    try {
      const diagram = JSON.parse(workspace.paneLayout) as {
        nodes?: Array<{ kind?: string; label?: string }>;
      };
      const terminals = (diagram.nodes ?? [])
        .filter((node) => node.kind === "terminal")
        .map((node, index) => ({
          label: node.label?.trim() || `Terminal ${index + 1}`,
        }));
      if (terminals.length > 0) return terminals;
    } catch {
      // Fall through to persisted pane rows/count for older canvas layouts.
    }
  }

  try {
    const panes = await invoke<TrayPane[]>("db_list_panes", {
      workspaceId: workspace.id,
    });
    if (panes.length > 0) {
      return panes
        .sort((left, right) => left.paneIndex - right.paneIndex)
        .map((pane, index) => ({
          label:
            pane.autoLaunch && pane.lastCommand?.trim()
              ? pane.lastCommand.trim()
              : `Terminal ${index + 1}`,
        }));
    }
  } catch {
    // The popup can still show count-based placeholders when DB pane rows are absent.
  }

  return Array.from({ length: Math.max(0, workspace.count) }, (_, index) => ({
    label: `Terminal ${index + 1}`,
  }));
}
