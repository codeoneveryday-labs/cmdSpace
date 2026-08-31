import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentUserPrompt.tsx", import.meta.url),
  "utf8",
);

describe("AgentUserPrompt contract", () => {
  it("owns prompt editing, copy and chat-history attachment rendering", () => {
    expect(source).toContain("export function AgentUserPrompt");
    expect(source).toContain("Copy prompt");
    expect(source).toContain("Edit prompt");
    expect(source).toContain("export function ChatHistoryCard");
    expect(source).toContain("onEdit");
  });
});
