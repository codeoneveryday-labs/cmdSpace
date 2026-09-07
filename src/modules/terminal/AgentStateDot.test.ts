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
  it("renders the shared cli-spinners dots loader", () => {
    expect(source).toContain('working: { color: "bg-primary"');
    expect(source).toContain("Spinner");
    expect(spinnerSource).toContain('import cliSpinners from "cli-spinners"');
    expect(spinnerSource).toContain("cliSpinners.dots.frames");
    expect(spinnerSource).toContain("cliSpinners.dots.interval");
    expect(spinnerSource).toContain("prefers-reduced-motion");
    expect(spinnerSource).toContain("h-4 w-3");
    expect(source).not.toContain("bg-activity");
  });

  it("uses a green tick for completed work", () => {
    expect(source).toContain("Tick02Icon");
    expect(source).toContain("text-emerald-500");
  });
});
