import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceForkSetup.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceForkSetup contract", () => {
  it("keeps fork prompt presentation separate from workspace lifecycle", () => {
    expect(source).toContain("export function WorkspaceForkSetup");
    expect(source).toContain("Fork workspace message");
    expect(source).toContain("Create workspace");
    expect(source).toContain("onCreate");
    expect(source).not.toContain("invoke(");
  });
});
