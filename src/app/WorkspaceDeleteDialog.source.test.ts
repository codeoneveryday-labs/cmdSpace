import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceDeleteDialog.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceDeleteDialog contract", () => {
  it("keeps confirmation UI controlled by explicit callbacks", () => {
    expect(source).toContain("WorkspaceDeleteDialog");
    expect(source).toContain("open: boolean");
    expect(source).toContain("onDoNotAskAgainChange");
    expect(source).toContain("onCancel");
    expect(source).toContain("onConfirm");
    expect(source).toContain("Delete workspace?");
    expect(source).toContain("Do not ask again");
    expect(source).not.toContain("db_delete_workspace");
  });
});
