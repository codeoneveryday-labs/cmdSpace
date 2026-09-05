import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppWindowEvents.ts", import.meta.url),
  "utf8",
);

describe("useAppWindowEvents contract", () => {
  it("registers and disposes the app-level Tauri window events", () => {
    expect(source).toContain("useAppWindowEvents");
    expect(source).toContain('listen("cmdspace:new-tab"');
    expect(source).toContain('listen("cmdspace:open-shortcuts"');
    expect(source).toContain('listen("cmdspace:maximize-pane"');
    expect(source).toContain("unlisten.then((dispose) => dispose())");
    expect(source).toContain('listen("cmdspace:exit-requested"');
    expect(source).toContain('invoke("app_exit_flush_complete"');
    expect(source).toContain('listen("cmdspace:open-files"');
    expect(source).toContain('invoke<string[]>("drain_open_files")');
  });
});
