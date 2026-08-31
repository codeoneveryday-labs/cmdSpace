import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "FileExplorerRow.tsx",
);

describe("FileExplorerRow", () => {
  it("maps every row model variant to its dedicated row surface", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("case \"entry\":");
    expect(source).toContain("case \"rename\":");
    expect(source).toContain("<EntryRow");
    expect(source).toContain("<PendingRow");
    expect(source).toContain("<StatusRow");
    expect(source).toContain("onInternalDragEnd");
  });
});
