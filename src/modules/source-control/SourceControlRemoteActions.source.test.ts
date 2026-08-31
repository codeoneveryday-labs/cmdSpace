import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "sourceControlRemoteActionExecution.ts",
);

describe("sourceControlRemoteActions", () => {
  it("owns contextual action selection and remote operation sequencing", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("getContextualRemoteAction");
    expect(source).toContain("performSourceControlRemoteAction");
    expect(source).toContain("missing-upstream");
    expect(source).toContain("Promise<void>");
    expect(source).toContain("await refresh();");
  });
});
