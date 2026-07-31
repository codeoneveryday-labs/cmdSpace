import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const constantsPath = path.join(here, "constants.ts");
const settingsStorePath = path.join(here, "../settings/store.ts");
const themeTypesPath = path.join(here, "types.ts");

describe("theme constants", () => {
  it("keeps DEFAULT_THEME_ID in one theme constants module", () => {
    const constantsSource = readFileSync(constantsPath, "utf8");
    const settingsStoreSource = readFileSync(settingsStorePath, "utf8");
    const themeTypesSource = readFileSync(themeTypesPath, "utf8");

    expect(constantsSource).toContain(
      'export const DEFAULT_THEME_ID = "cmdspace-default";',
    );
    expect(settingsStoreSource).not.toContain(
      'export const DEFAULT_THEME_ID = "cmdspace-default";',
    );
    expect(themeTypesSource).not.toContain(
      'export const DEFAULT_THEME_ID = "cmdspace-default";',
    );
  });
});
