import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const canvasSource = readFileSync(join(here, "../ArchitectureCanvas.tsx"), "utf8");
const stateSource = readFileSync(join(here, "useCanvasDiagramState.ts"), "utf8");

describe("ArchitectureCanvas diagram state seam", () => {
  it("keeps seed normalization, ID sequences, and diagram ownership in one hook", () => {
    expect(canvasSource).toContain("const {\n    nodes,");
    expect(canvasSource).toContain("} = useCanvasDiagramState(seed);");
    expect(stateSource).toContain("normalizeDiagramSeed(seed)");
    expect(stateSource).toContain('nextDiagramIdSequence(');
    expect(stateSource).toContain("useState<ArchitectureNode[]>");
    expect(stateSource).toContain("useState<ArchitectureEdge[]>");
    expect(stateSource).toContain("ArchitectureTerminalDockGroup[]");
  });
});
