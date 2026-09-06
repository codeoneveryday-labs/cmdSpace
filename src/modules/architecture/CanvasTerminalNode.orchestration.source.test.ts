import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const terminalSource = readFileSync(
  new URL("./CanvasTerminalNode.tsx", import.meta.url),
  "utf8",
);
const headerSource = readFileSync(
  new URL("./CanvasTerminalHeader.tsx", import.meta.url),
  "utf8",
);

describe("Canvas orchestrator terminal", () => {
  it("uses the ordinary terminal chrome with a clear role border and badge", () => {
    expect(terminalSource).toContain("orchestrator");
    expect(terminalSource).toContain("border-violet-400");
    expect(headerSource).toContain("ORCHESTRATOR");
  });
});
