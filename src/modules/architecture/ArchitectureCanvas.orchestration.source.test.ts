import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ArchitectureCanvas.tsx", import.meta.url),
  "utf8",
);

describe("ArchitectureCanvas orchestration surface", () => {
  it("keeps the Boss terminal as the only orchestration interaction surface", () => {
    expect(source).not.toContain("OrchestrationCanvasPanel");
  });
});
