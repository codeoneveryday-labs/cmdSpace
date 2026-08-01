import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function readTauriConfig(name: string) {
  return JSON.parse(
    readFileSync(path.join(root, "src-tauri", name), "utf8"),
  ) as { app: { windows: Array<{ title?: string }> } };
}

describe("Tauri platform configuration", () => {
  it("keeps the Windows window title aligned with the base app identity", () => {
    const base = readTauriConfig("tauri.conf.json");
    const windows = readTauriConfig("tauri.windows.conf.json");

    expect(windows.app.windows[0]?.title).toBe(base.app.windows[0]?.title);
  });
});
