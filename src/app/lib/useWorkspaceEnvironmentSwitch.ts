import { homeDir } from "@tauri-apps/api/path";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { native } from "@/modules/ai/lib/native";
import { disposeSession } from "@/modules/terminal";
import type { SearchAddon } from "@xterm/addon-search";
import type { EditorPaneHandle } from "@/modules/editor";
import type { PreviewPaneHandle } from "@/modules/preview";
import type { TerminalPaneHandle } from "@/modules/terminal";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceEnv } from "@/modules/workspace";
import { LOCAL_WORKSPACE, getWslHome } from "@/modules/workspace";
import type { WorkspaceRecord } from "./useWorkspaceController";

export function useWorkspaceEnvironmentSwitch({
  workspaceEnv,
  tabsRef,
  liveLeavesRef,
  searchAddons,
  terminalRefs,
  editorRefs,
  previewRefs,
  setActiveSearchAddon,
  setActiveEditorHandle,
  setWorkspaceEnv,
  setHome,
  setLaunchCwd,
  setWorkspaces,
  resetWorkspace,
}: {
  workspaceEnv: WorkspaceEnv;
  tabsRef: MutableRefObject<readonly Tab[]>;
  liveLeavesRef: MutableRefObject<Set<number>>;
  searchAddons: MutableRefObject<Map<number, SearchAddon>>;
  terminalRefs: MutableRefObject<Map<number, TerminalPaneHandle>>;
  editorRefs: MutableRefObject<Map<number, EditorPaneHandle>>;
  previewRefs: MutableRefObject<Map<number, PreviewPaneHandle>>;
  setActiveSearchAddon: (addon: SearchAddon | null) => void;
  setActiveEditorHandle: (handle: EditorPaneHandle | null) => void;
  setWorkspaceEnv: (env: WorkspaceEnv) => void;
  setHome: (home: string | null) => void;
  setLaunchCwd: (cwd: string | null) => void;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceRecord[]>>;
  resetWorkspace: (cwd?: string) => void;
}) {
  return useCallback(
    async (env: WorkspaceEnv) => {
      const sameEnvironment =
        env.kind === workspaceEnv.kind &&
        (env.kind === "local" ||
          (workspaceEnv.kind === "wsl" && env.distro === workspaceEnv.distro));
      if (sameEnvironment) return;

      if (tabsRef.current.some((tab) => tab.kind === "editor" && tab.dirty)) {
        window.alert("Save or close unsaved editor tabs before switching workspace.");
        return;
      }

      let nextHome: string | null = null;
      try {
        nextHome =
          env.kind === "wsl"
            ? await getWslHome(env.distro)
            : (await homeDir()).replace(/\\/g, "/");
      } catch (error) {
        window.alert(String(error));
        return;
      }

      for (const id of liveLeavesRef.current) disposeSession(id);
      searchAddons.current.clear();
      terminalRefs.current.clear();
      editorRefs.current.clear();
      previewRefs.current.clear();
      setActiveSearchAddon(null);
      setActiveEditorHandle(null);
      setWorkspaceEnv(env.kind === "local" ? LOCAL_WORKSPACE : env);
      setHome(nextHome);
      setLaunchCwd(nextHome);
      if (nextHome) {
        try {
          await native.workspaceAuthorize(nextHome);
        } catch {
          // Non-fatal; the Git panel can surface authorization state.
        }
      }
      setWorkspaces((current) =>
        current.map((workspace) => ({
          ...workspace,
          tabId: null,
          canvasTabId: null,
        })),
      );
      resetWorkspace(nextHome ?? undefined);
    },
    [
      editorRefs,
      liveLeavesRef,
      previewRefs,
      resetWorkspace,
      searchAddons,
      setActiveEditorHandle,
      setActiveSearchAddon,
      setHome,
      setLaunchCwd,
      setWorkspaceEnv,
      setWorkspaces,
      tabsRef,
      terminalRefs,
      workspaceEnv,
    ],
  );
}
