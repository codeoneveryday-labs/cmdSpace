import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const storePath = join(here, "store.ts");

/**
 * Every persisted preference key must be mapped in onPreferencesChange.
 * A missing entry silently drops cross-window sync AND the in-memory
 * zustand update, leaving the Settings toggle stuck (see: preventSleep).
 */
describe("settings store key map integrity", () => {
  it("maps every KEY_* constant in onPreferencesChange", () => {
    const source = readFileSync(storePath, "utf8");
    const declared = new Set(
      [...source.matchAll(/^const (KEY_[A-Z_0-9]+) =/gm)].map((m) => m[1]),
    );
    const mapped = new Set(
      [...source.matchAll(/^\s*\[(KEY_[A-Z_0-9]+)\]:/gm)].map((m) => m[1]),
    );

    expect(declared.size).toBeGreaterThan(0);
    expect(mapped.size).toBeGreaterThan(0);
    expect([...mapped].filter((key) => !declared.has(key))).toEqual([]);
    expect([...declared].filter((key) => !mapped.has(key))).toEqual([]);
  });
});
