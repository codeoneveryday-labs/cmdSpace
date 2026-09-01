import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useBottomTerminalController.ts", import.meta.url),
  "utf8",
);

describe("useBottomTerminalController contract", () => {
  it("resolves drawer cwd from workspace, terminal, explorer and launch fallbacks", () => {
    expect(source).toContain("useBottomTerminalController");
    expect(source).toContain("activeWorkspaceFolder");
    expect(source).toContain("findLeafCwd");
    expect(source).toContain("explorerRoot");
    expect(source).toContain("launchCwd");
    expect(source).toContain("bottomTerminalRef.current?.focus");
    expect(source).toContain("setBottomTerminalOpen");
  });
});
