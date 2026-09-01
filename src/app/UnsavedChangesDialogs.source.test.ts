import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./UnsavedChangesDialogs.tsx", import.meta.url),
  "utf8",
);

describe("UnsavedChangesDialogs contract", () => {
  it("keeps close and deleted-file confirmations controlled by App", () => {
    expect(source).toContain("UnsavedChangesDialogs");
    expect(source).toContain("pendingCloseTab");
    expect(source).toContain("pendingDeleteTabs");
    expect(source).toContain("onConfirmClose");
    expect(source).toContain("onConfirmDelete");
    expect(source).toContain("Close Anyway");
    expect(source).not.toContain("disposeTab");
  });
});
