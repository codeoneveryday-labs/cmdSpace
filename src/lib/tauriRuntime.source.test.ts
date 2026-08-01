import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const runtimePath = path.join(here, "tauriRuntime.ts");

describe("tauri browser fallback", () => {
  it("detects missing Tauri runtime before app modules are imported", () => {
    const source = readFileSync(runtimePath, "utf8");

    expect(source).toContain("__TAURI_INTERNALS__");
    expect(source).toContain("__TAURI__");
    expect(source).toContain("cmdSpace desktop runtime required");
    expect(source).toContain("Network remote access");
  });
});
