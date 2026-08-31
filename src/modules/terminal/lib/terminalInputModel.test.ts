import { describe, expect, it, vi } from "vitest";
import {
  replaceCurrentTerminalInput,
  replaceUntouchedTerminalInput,
  type TerminalInputState,
} from "./terminalInputModel";

const idleState: TerminalInputState = {
  hasPty: true,
  inputBuffer: "draft",
  inCommand: false,
  interactiveCodingAgent: false,
};

describe("terminalInputModel", () => {
  it("replaces an untouched draft after clearing the current line", () => {
    const write = vi.fn();

    expect(replaceUntouchedTerminalInput(idleState, "draft", "updated", write)).toBe(true);
    expect(write.mock.calls).toEqual([["\u0015"], ["updated"]]);
  });

  it("does not overwrite a changed draft or running command", () => {
    const write = vi.fn();

    expect(replaceUntouchedTerminalInput(idleState, "other", "updated", write)).toBe(false);
    expect(
      replaceUntouchedTerminalInput(
        { ...idleState, inCommand: true },
        "draft",
        "updated",
        write,
      ),
    ).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not write when the PTY is unavailable", () => {
    const write = vi.fn();

    expect(
      replaceCurrentTerminalInput({ ...idleState, hasPty: false }, "updated", write),
    ).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("allows replacing input inside an interactive coding agent", () => {
    const write = vi.fn();

    expect(
      replaceCurrentTerminalInput(
        { ...idleState, inCommand: true, interactiveCodingAgent: true },
        "updated",
        write,
      ),
    ).toBe(true);
    expect(write.mock.calls).toEqual([["\u0015"], ["updated"]]);
  });

  it("does not clear an already empty input line", () => {
    const write = vi.fn();

    expect(
      replaceCurrentTerminalInput({ ...idleState, inputBuffer: "" }, "updated", write),
    ).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("updated");
  });
});
