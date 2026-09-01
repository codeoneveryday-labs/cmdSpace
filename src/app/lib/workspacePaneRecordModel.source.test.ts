import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./workspacePaneRecordModel.ts", import.meta.url), "utf8");

describe("workspacePaneRecordModel contract", () => {
  it("owns pane persistence policy without React or IPC", () => {
    expect(source).toContain("buildWorkspacePaneRecord");
    expect(source).toContain("preserveExistingNativeSession");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("invoke(");
  });
});
