import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = new URL(".", import.meta.url).pathname;

describe("agent activity listener lifecycle", () => {
  it("does not subscribe to Tauri events while useTerminalSession is imported", () => {
    const source = readFileSync(`${here}useTerminalSession.ts`, "utf8");
    expect(source).not.toMatch(/^(?!\s)(?!\/\/).*ensureAgentActivityListener\(\);/m);
  });

  it("keeps listener registration inside a React lifecycle", () => {
    const source = readFileSync(`${here}useTerminalSession.ts`, "utf8");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("ensureAgentActivityListener();");
  });
});
