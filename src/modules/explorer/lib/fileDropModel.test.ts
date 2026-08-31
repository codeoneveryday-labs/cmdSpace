import { describe, expect, it } from "vitest";
import { resolveDropDestination } from "./fileDropModel";

describe("fileDropModel", () => {
  const entries = new Map([
    ["/repo/src", { path: "/repo/src", isDir: true }],
    ["/repo/README.md", { path: "/repo/README.md", isDir: false }],
  ]);

  it("prefers an explicit directory target and resolves file targets to parents", () => {
    expect(resolveDropDestination("/repo/src", true, null, entries, "/repo")).toBe("/repo/src");
    expect(resolveDropDestination("/repo/README.md", false, null, entries, "/repo")).toBe("/repo");
  });

  it("falls back to the focused entry and then the root", () => {
    expect(resolveDropDestination(undefined, undefined, "/repo/src", entries, "/repo")).toBe("/repo/src");
    expect(resolveDropDestination(undefined, undefined, "/repo/README.md", entries, "/repo")).toBe("/repo");
    expect(resolveDropDestination(undefined, undefined, null, entries, "/repo")).toBe("/repo");
  });
});
