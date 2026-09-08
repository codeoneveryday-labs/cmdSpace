import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("Canvas orchestration integration seam", () => {
  it("owns worker reconciliation and task status projection outside the canvas coordinator", () => {
    const source = readFileSync(
      path.join(here, "useCanvasOrchestrationIntegration.ts"),
      "utf8",
    );
    const canvas = readFileSync(
      path.join(here, "..", "ArchitectureCanvas.tsx"),
      "utf8",
    );

    expect(source).toContain("useCanvasOrchestrationWorkers");
    expect(source).toContain("useCanvasOrchestrationRun");
    expect(source).toContain("taskStatuses");
    expect(canvas).toContain("useCanvasLifecycle");
    expect(canvas).not.toContain("useCanvasOrchestrationWorkers({");
    expect(canvas).not.toContain("new Map(\n        (orchestration.run?.tasks");
  });
});
