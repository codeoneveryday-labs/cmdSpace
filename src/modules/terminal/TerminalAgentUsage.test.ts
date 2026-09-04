import { describe, expect, it } from "vitest";
import { extractOpenCodeSessionTitle } from "./TerminalAgentUsage";

describe("extractOpenCodeSessionTitle", () => {
  it("extracts the full default session title from TUI buffer text", () => {
    const buffer = [
      "│ New session - 2026-09-03T11:35:14.641Z",
      "│ Context",
      "│ 85,647 tokens",
    ].join("\n");
    expect(extractOpenCodeSessionTitle(buffer)).toBe(
      "New session - 2026-09-03T11:35:14.641Z",
    );
  });

  it("distinguishes two panes running different sessions", () => {
    expect(
      extractOpenCodeSessionTitle("New session - 2026-09-03T06:29:43.890Z"),
    ).toBe("New session - 2026-09-03T06:29:43.890Z");
    expect(
      extractOpenCodeSessionTitle("New session - 2026-09-03T11:35:14.641Z"),
    ).toBe("New session - 2026-09-03T11:35:14.641Z");
  });

  it("returns null when no session title is visible yet", () => {
    expect(extractOpenCodeSessionTitle(null)).toBeNull();
    expect(extractOpenCodeSessionTitle("")).toBeNull();
    expect(extractOpenCodeSessionTitle("$ opencode\nloading…")).toBeNull();
  });
});
