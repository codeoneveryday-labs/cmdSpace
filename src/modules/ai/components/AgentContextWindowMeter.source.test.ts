import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentContextWindowMeter.tsx", import.meta.url),
  "utf8",
);

describe("AgentContextWindowMeter contract", () => {
  it("renders context usage with unavailable and warning states", () => {
    expect(source).toContain("export function AgentContextWindowMeter");
    expect(source).toContain("Context window unavailable from this CLI");
    expect(source).toContain("contextIsEstimated");
    expect(source).toContain("rgb(239 68 68)");
    expect(source).toContain("% used");
  });
});
