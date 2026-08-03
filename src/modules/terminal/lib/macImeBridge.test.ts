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
});
