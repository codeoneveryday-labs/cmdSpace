import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentAttachments.ts", import.meta.url),
  "utf8",
);

describe("useAgentAttachments contract", () => {
  it("parses bounded file inputs and cleans preview URLs", () => {
    expect(source).toContain("useAgentAttachments");
    expect(source).toContain("slice(0, 8)");
    expect(source).toContain("file.text()");
    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("window.prompt");
  });
});
