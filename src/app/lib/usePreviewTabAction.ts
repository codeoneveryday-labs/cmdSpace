import { useCallback, type MutableRefObject } from "react";
import type { PreviewPaneHandle } from "@/modules/preview";

export function usePreviewTabAction({
  newPreviewTab,
  previewRefs,
}: {
  newPreviewTab: (url: string) => number;
  previewRefs: MutableRefObject<Map<number, PreviewPaneHandle>>;
}) {
  return useCallback(
    (url: string) => {
      const id = newPreviewTab(url);
      // Empty preview tabs should open with the address bar ready for input.
      if (!url) {
        setTimeout(() => previewRefs.current.get(id)?.focusAddressBar(), 0);
      }
      return id;
    },
    [newPreviewTab, previewRefs],
  );
}
