import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentToolTimelineItem.tsx", import.meta.url),
  "utf8",
);

describe("AgentToolTimelineItem contract", () => {
  it("renders tool status and optional detail", () => {
    expect(source).toContain("export function AgentToolTimelineItem");
    expect(source).toContain("item.name");
    expect(source).toContain("item.status");
    expect(source).toContain("item.detail");
  });
});
