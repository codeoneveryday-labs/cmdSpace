import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./FileExplorerHeader.tsx", import.meta.url),
  "utf8",
);

describe("FileExplorerHeader contract", () => {
  it("owns root presentation and explorer header actions", () => {
    expect(source).toContain("export function FileExplorerHeader");
    expect(source).toContain("onCreateFile");
    expect(source).toContain("onCreateFolder");
    expect(source).toContain("onRefresh");
  });
});
