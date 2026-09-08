import type { ArchitectureDiagram } from "@/modules/tabs";

export function buildPersistedCanvasDiagram(
  diagram: Required<
    Pick<ArchitectureDiagram, "nodes" | "edges">
  > &
    Pick<ArchitectureDiagram, "terminalDockGroups">,
): ArchitectureDiagram {
  return {
    nodes: diagram.nodes,
    edges: diagram.edges,
    terminalDockGroups: diagram.terminalDockGroups ?? [],
  };
}
