import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { EditorPaneHandle } from "@/modules/editor";
import type { TerminalPaneHandle } from "@/modules/terminal";

export function useAppHandleRegistry({
  activeId,
  terminalRefs,
  editorRefs,
  setActiveEditorHandle,
}: {
  activeId: number;
  terminalRefs: MutableRefObject<Map<number, TerminalPaneHandle>>;
  editorRefs: MutableRefObject<Map<number, EditorPaneHandle>>;
  setActiveEditorHandle: Dispatch<SetStateAction<EditorPaneHandle | null>>;
}) {
  useEffect(() => {
    setActiveEditorHandle(editorRefs.current.get(activeId) ?? null);
  }, [activeId, editorRefs, setActiveEditorHandle]);

  const registerTerminalHandle = useCallback(
    (leafId: number, handle: TerminalPaneHandle | null) => {
      if (handle) terminalRefs.current.set(leafId, handle);
      else terminalRefs.current.delete(leafId);
    },
    [terminalRefs],
  );

  const registerEditorHandle = useCallback(
    (id: number, handle: EditorPaneHandle | null) => {
      if (handle) editorRefs.current.set(id, handle);
      else editorRefs.current.delete(id);
      if (id === activeId) setActiveEditorHandle(handle);
    },
    [activeId, editorRefs, setActiveEditorHandle],
  );

  return { registerTerminalHandle, registerEditorHandle };
}
