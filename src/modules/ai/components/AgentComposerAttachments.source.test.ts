import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentComposerAttachments.tsx", import.meta.url),
  "utf8",
);

describe("AgentComposerAttachments contract", () => {
  it("renders removable file and history attachment chips", () => {
    expect(source).toContain("export function AgentComposerAttachments");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("Remove attachment");
    expect(source).toContain("Remove chat history");
    expect(source).toContain("ChatHistoryCard");
  });
});
