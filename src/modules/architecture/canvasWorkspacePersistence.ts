import type { ArchitectureDiagram } from "@/modules/tabs";

const CANVAS_WORKSPACE_LAYOUT_KIND = "architecture-canvas";
const CANVAS_WORKSPACE_LAYOUT_VERSION = 1;

type CanvasWorkspaceLayout = {
  kind: typeof CANVAS_WORKSPACE_LAYOUT_KIND;
  version: typeof CANVAS_WORKSPACE_LAYOUT_VERSION;
  diagram: ArchitectureDiagram;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function serializeCanvasWorkspaceDiagram(
  diagram: ArchitectureDiagram,
): string {
  return JSON.stringify({
    kind: CANVAS_WORKSPACE_LAYOUT_KIND,
    version: CANVAS_WORKSPACE_LAYOUT_VERSION,
    diagram,
  } satisfies CanvasWorkspaceLayout);
}

export function parseCanvasWorkspaceDiagram(
  persisted: string | null | undefined,
): ArchitectureDiagram | null {
  if (!persisted) return null;

  try {
    const value: unknown = JSON.parse(persisted);
    if (
      !isRecord(value) ||
      value.kind !== CANVAS_WORKSPACE_LAYOUT_KIND ||
      value.version !== CANVAS_WORKSPACE_LAYOUT_VERSION ||
      !isRecord(value.diagram) ||
      !Array.isArray(value.diagram.nodes) ||
      !Array.isArray(value.diagram.edges)
    ) {
      return null;
    }
    return value.diagram as ArchitectureDiagram;
  } catch {
    return null;
  }
}
