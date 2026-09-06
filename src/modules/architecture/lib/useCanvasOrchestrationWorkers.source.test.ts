import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  new URL("./useCanvasOrchestrationWorkers.ts", import.meta.url),
  "utf8",
);
const spawnSource = readFileSync(
  new URL("./orchestrationWorkerSpawn.ts", import.meta.url),
  "utf8",
);

describe("useCanvasOrchestrationWorkers prompt handoff", () => {
  it("polls registered terminal handles to deliver briefs", () => {
    expect(hookSource).toContain("terminalHandles");
    expect(hookSource).toContain("tryDeliverWorkerPrompt");
    expect(hookSource).toContain("ORCHESTRATION_PROMPT_POLL_MS");
    expect(hookSource).toContain("ORCHESTRATION_PROMPT_MAX_ATTEMPTS");
  });

  it("types briefs without auto-submitting", () => {
    expect(spawnSource).toContain("replaceCurrentInput");
    expect(spawnSource).not.toContain("\\\\r");
  });
});
