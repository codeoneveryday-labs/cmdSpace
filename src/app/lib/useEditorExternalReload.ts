import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef } from "react";
import type { EditorPaneHandle } from "@/modules/editor";
import type { Tab } from "@/modules/tabs";

type Input = {
  tabs: Tab[];
  tabsRef: { current: Tab[] };
  editorRefs: { current: Map<number, EditorPaneHandle> };
};

export function useEditorExternalReload({ tabs, tabsRef, editorRefs }: Input): void {
  const appliedDiffsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.kind !== "ai-diff" || tab.status !== "approved") continue;
      if (appliedDiffsRef.current.has(tab.approvalId)) continue;
      appliedDiffsRef.current.add(tab.approvalId);
      for (const editor of tabs) {
        if (editor.kind === "editor" && editor.path === tab.path) {
          editorRefs.current.get(editor.id)?.reload();
        }
      }
    }
  }, [editorRefs, tabs]);

  useEffect(() => {
    type FileWrittenPayload = { path: string; source?: string };
    const unlistenPromise = getCurrentWebviewWindow().listen<FileWrittenPayload>(
      "fs:file-written",
      (event) => {
        if (event.payload.source === "editor") return;
        const normalizedPath = event.payload.path.replace(/\\/g, "/");
        for (const tab of tabsRef.current) {
          if (tab.kind !== "editor") continue;
          if (tab.path.replace(/\\/g, "/") === normalizedPath) {
            editorRefs.current.get(tab.id)?.reload();
          }
        }
      },
    );
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [editorRefs, tabsRef]);
}
