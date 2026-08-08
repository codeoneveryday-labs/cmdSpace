import { describe, expect, it } from "vitest";
import * as macImeBridge from "./macImeBridge";

type MacImeBridgeModule = typeof macImeBridge & {
  normalizeMacTerminalInput?: (value: string) => string;
};

describe("normalizeMacTerminalInput", () => {
  it("turns corrupted C1 control runs into a shell word separator", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize).toBeTypeOf("function");
    expect(normalize?.("mcli\u0083\u0080status")).toBe("mcli status");
  });

  it("preserves valid terminal input", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize?.("mcli status\r")).toBe("mcli status\r");
  });

  it("turns a corrupted no-break space into a shell word separator", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize?.("git clone\u00a0https://example.com/repo.git")).toBe(
      "git clone https://example.com/repo.git",
    );
  });

  it("normalizes C1 and regular spaces identically so a follow-up keystroke never diffs into a spurious DEL", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    // "mcli " as stored by WebKit (space arrives as C1 0x83) then a real space
    const from = normalize?.("mcli\u0083") ?? "?";
    const to = normalize?.("mcli ") ?? "?";
    expect(from).toBe("mcli ");
    expect(to).toBe(from);
  });

  it("keeps a plain space out of the macOS IME text-input path", () => {
    const event = { type: "keydown", key: " " } as KeyboardEvent;
    expect(macImeBridge.shouldUseMacTextInputPath?.(event)).toBe(false);
    expect(macImeBridge.shouldIgnoreMacPrintableTerminalData?.(" ")).toBe(
      false,
    );
  });

  it("normalizes space lookalikes but not a plain space", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;
    expect(normalize?.("\u0083")).toBe(" ");
    expect(normalize?.("\u00a0")).toBe(" ");
    expect(normalize?.(" ")).toBe(" ");
  });
});
