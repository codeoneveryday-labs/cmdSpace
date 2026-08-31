import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./sourceControlStatusMutations.ts", import.meta.url),
  "utf8",
);

describe("sourceControlStatusMutations contract", () => {
  it("keeps optimistic status transitions pure and covers rename unstage", () => {
    expect(source).toContain("optimisticStage");
    expect(source).toContain("optimisticUnstage");
    expect(source).toContain("optimisticDiscard");
    expect(source).toContain('indexStatus === "R"');
    expect(source).not.toContain("native.git");
    expect(source).not.toContain("useState");
  });
});
