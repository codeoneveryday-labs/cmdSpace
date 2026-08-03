import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "TerminalPane.tsx"), "utf8");

describe("TerminalPane", () => {
  it("can remove its top chrome inset for the Cmd+I terminal tabs", () => {
    expect(source).toContain("contentTopPadding?: boolean");
    expect(source).toContain("contentTopPadding = true");
    expect(source).toContain('contentTopPadding && "pt-12"');
  });
});
