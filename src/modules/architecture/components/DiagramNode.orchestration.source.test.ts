import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DiagramNode.tsx", import.meta.url), "utf8");

describe("DiagramNode orchestration identity", () => {
  it("labels coordinator, worker, and task roles without relying on color alone", () => {
    expect(source).toContain("ORCHESTRATOR");
    expect(source).toContain("WORKER");
    expect(source).toContain("TASK");
    expect(source).toContain("orchestrationRole");
  });
});
