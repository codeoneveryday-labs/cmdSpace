import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const updaterPath = path.join(here, "useUpdater.ts");

describe("useUpdater source contract", () => {
  it("avoids noisy automatic update checks in dev and throttles failed checks", () => {
    const source = readFileSync(updaterPath, "utf8");

    expect(source).toContain("const AUTO_CHECK_ENABLED = !import.meta.env.DEV");
    expect(source).toContain("if (!autoCheck || !AUTO_CHECK_ENABLED) return");
    expect(source).toContain("if (!manual) {");
    expect(source).toContain("localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))");
    expect(source).toContain("setStatus({ kind: \"error\", message: String(err) })");
  });
});
