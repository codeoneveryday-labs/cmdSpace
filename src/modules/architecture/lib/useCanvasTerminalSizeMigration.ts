import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import { needsTerminalSizeMigration } from "./architectureDiagramSeed";
import { TERMINAL_DEFAULT_SIZE } from "./architectureCanvasModel";

export function useCanvasTerminalSizeMigration(
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>,
) {
  useEffect(() => {
    setNodes((current) =>
      current.map((item) =>
        needsTerminalSizeMigration(item)
          ? { ...item, ...TERMINAL_DEFAULT_SIZE, terminalChromeVersion: 2 }
          : item,
      ),
    );
  }, [setNodes]);
}
