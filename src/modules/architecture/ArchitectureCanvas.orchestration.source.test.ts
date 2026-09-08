import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ArchitectureCanvas.tsx", import.meta.url),
  "utf8",
);
const integrationSource = readFileSync(
  new URL("./lib/useCanvasOrchestrationIntegration.ts", import.meta.url),
  "utf8",
);
const presentationSource = readFileSync(
  new URL("./components/CanvasOrchestrationPresentation.tsx", import.meta.url),
  "utf8",
);

describe("ArchitectureCanvas orchestration surface", () => {
  it("keeps the Boss terminal as the only orchestration interaction surface", () => {
    expect(source).not.toContain("OrchestrationCanvasPanel");
  });

  it("spawns worker terminals for running orchestration tasks", () => {
    expect(integrationSource).toContain("useCanvasOrchestrationWorkers");
    expect(source).toContain("useCanvasLifecycle");
  });

  it("drives toolbar run controls without a side panel", () => {
    expect(integrationSource).toContain("useCanvasOrchestrationRun");
    expect(source).toContain("orchestration={");
  });

  it("flies mail envelopes between worker nodes", () => {
    expect(presentationSource).toContain("OrchestrationMailOverlay");
    expect(source).toContain("CanvasOrchestrationPresentation");
    expect(presentationSource).toContain("flights");
  });

  it("builds a task status map from the run snapshot for worker terminals", () => {
    expect(integrationSource).toContain("orchestration.run?.tasks");
    expect(integrationSource).toContain("taskStatuses");
    expect(source).toContain("taskStatuses: orchestration.taskStatuses");
  });
});
