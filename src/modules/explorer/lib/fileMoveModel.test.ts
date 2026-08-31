import { describe, expect, it } from "vitest";
import { prepareMovePaths } from "./fileMoveModel";

describe("fileMoveModel", () => {
  it("removes nested descendants while keeping independent sources", () => {
    expect(prepareMovePaths(["/repo/src", "/repo/src/App.tsx", "/repo/README.md"], "/repo/dest")).toEqual([
      "/repo/src",
      "/repo/README.md",
    ]);
  });

  it("rejects an empty or cyclic move", () => {
    expect(prepareMovePaths(["/repo/src"], "/repo/src")).toBeNull();
    expect(prepareMovePaths(["/repo/src"], "/repo/src/nested")).toBeNull();
  });
});
