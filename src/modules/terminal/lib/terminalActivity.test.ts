import { describe, expect, it } from "vitest";
import { noteTerminalOutput } from "./terminalActivity";

describe("noteTerminalOutput", () => {
  it("marks the terminal active until the quiet window expires", () => {
    expect(noteTerminalOutput(100, 900)).toEqual({ active: true, expiresAt: 1000 });
  });

  it("extends activity from the most recent output", () => {
    expect(noteTerminalOutput(450, 900)).toEqual({ active: true, expiresAt: 1350 });
  });
});
