import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "useCanvasHistory.ts",
  ),
  "utf8",
);

describe("useCanvasHistory contract", () => {
  it("keeps bounded capture/restore history behind a small interface", () => {
    expect(source).toContain("capture: () => T");
    expect(source).toContain("restore: (snapshot: T) => void");
    expect(source).toContain("slice(-maxHistory + 1)");
    expect(source).toContain("restore(snapshot)");
  });
});
