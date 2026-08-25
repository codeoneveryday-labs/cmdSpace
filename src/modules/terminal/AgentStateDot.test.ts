import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "AgentStateDot.tsx"),
  "utf8",
);

describe("AgentStateDot", () => {
  it("renders the three-dot working loader", () => {
    expect(source).toContain('working: { color: "bg-primary"');
    expect(source).toContain("cmdspace-agent-spinner-dot");
    expect(source).toContain("[0, 1, 2, 3, 4]");
    expect(source).not.toContain("bg-activity");
  });

  it("uses a green tick for completed work", () => {
    expect(source).toContain("Tick02Icon");
    expect(source).toContain("text-emerald-500");
  });
});
