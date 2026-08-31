import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentAssistantMessage.tsx", import.meta.url),
  "utf8",
);

describe("AgentAssistantMessage contract", () => {
  it("renders markdown responses with copy and fork actions", () => {
    expect(source).toContain("export function AgentAssistantMessage");
    expect(source).toContain("Streamdown");
    expect(source).toContain("Copy response");
    expect(source).toContain("Fork in a new workspace");
    expect(source).toContain("Worked for");
  });
});
