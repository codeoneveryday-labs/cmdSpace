import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/ai/tools/terminal.ts"),
  "utf8",
);
const appSource = readFileSync(
  resolve(process.cwd(), "src/app/App.tsx"),
  "utf8",
);

describe("terminal agent dispatch", () => {
  it("sends approved coding prompts as executable PTY input", () => {
    expect(source).toContain("dispatch_to_terminals: tool({");
    expect(source).toContain("needsApproval: false");
    expect(source).toContain(
      'prompt: z.string().min(20).max(12_000).optional()',
    );
    expect(source).toContain("getActiveTerminalAgents()");
    expect(source).toContain("getActiveTerminalPaneIndex()");
    expect(appSource).toContain(
      'term.write(prompt.replace(/[\\r\\n]+$/, "") + "\\r")',
    );
  });
});
