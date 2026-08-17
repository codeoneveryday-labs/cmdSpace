import { describe, expect, it } from "vitest";
import { resolveAgentSwitchCommand } from "./TerminalAgentSwitcher";

describe("resolveAgentSwitchCommand", () => {
  it("prefers the Settings override", () => {
    expect(resolveAgentSwitchCommand("codex", { codex: "codex --fast" })).toBe(
      "codex --fast",
    );
  });

  it("uses the catalog launch command without an override", () => {
    expect(resolveAgentSwitchCommand("codex", {})).toBeTruthy();
  });

  it("uses no command for Terminal", () => {
    expect(resolveAgentSwitchCommand(null, {})).toBeNull();
  });
});
