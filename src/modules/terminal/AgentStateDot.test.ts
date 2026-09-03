import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "AgentStateDot.tsx"),
  "utf8",
);
const spinnerSource = readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "../../components/ui/spinner.tsx"),
  "utf8",
);

describe("AgentStateDot", () => {
  it("renders the three-dot working loader", () => {
    expect(source).toContain('working: { color: "bg-primary"');
    expect(source).toContain("Spinner");
    expect(spinnerSource).toContain("cmdspace-loading-dot");
    expect(spinnerSource).toContain("DOT_COUNT = 3");
    expect(spinnerSource).toContain("left-1/2 top-1/2");
    expect(spinnerSource).toContain("h-4 w-3");
    expect(spinnerSource).toContain("animationDelay: `${index * 120}ms`");
    expect(source).not.toContain("bg-activity");
  });

  it("uses a green tick for completed work", () => {
    expect(source).toContain("Tick02Icon");
    expect(source).toContain("text-emerald-500");
  });
});
