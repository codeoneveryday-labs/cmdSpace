import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentChatControls.ts", import.meta.url),
  "utf8",
);

describe("useAgentChatControls contract", () => {
  it("owns model/cache/config and slash-option discovery", () => {
    expect(source).toContain("useAgentChatControls");
    expect(source).toContain("listAgentChatModels");
    expect(source).toContain("listAgentChatSlashOptions");
    expect(source).toContain("loadAgentChatConfig");
    expect(source).toContain("saveAgentChatConfig");
    expect(source).toContain("loadAgentModelCache");
    expect(source).toContain("controlsRequestRef");
  });

  it("defers CLI control discovery until a picker requests it", () => {
    expect(source).toContain("loadControlsOnDemand");
    expect(source).not.toContain("const needsCliDefaults");
    expect(source).not.toContain("await loadControls()");
  });
});
