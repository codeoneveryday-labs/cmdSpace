import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./tabTypes.ts", import.meta.url), "utf8");

describe("tabTypes contract", () => {
  it("keeps all tab variants in a dedicated domain type module", () => {
    expect(source).toContain("export type TerminalTab");
    expect(source).toContain("export type ArchitectureTab");
    expect(source).toContain("export type AgentChatTab");
    expect(source).toContain("export type Tab =");
    expect(source).toContain("export type TabPatch");
  });
});
