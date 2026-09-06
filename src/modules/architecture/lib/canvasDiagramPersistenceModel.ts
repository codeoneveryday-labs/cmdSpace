import type { ArchitectureDiagram } from "@/modules/tabs";

export function buildPersistedCanvasDiagram(
  diagram: Required<
    Pick<ArchitectureDiagram, "nodes" | "edges">
  > &
    Pick<
      ArchitectureDiagram,
      "canvasPurpose" | "orchestrationProvider" | "orchestrationRunId" | "terminalDockGroups"
    >,
): ArchitectureDiagram {
  return {
    canvasPurpose: diagram.canvasPurpose ?? "architecture",
    ...(diagram.orchestrationProvider ? { orchestrationProvider: diagram.orchestrationProvider } : {}),
    orchestrationRunId: diagram.orchestrationRunId ?? null,
    nodes: diagram.nodes,
    edges: diagram.edges,
    terminalDockGroups: diagram.terminalDockGroups ?? [],
  };
}
