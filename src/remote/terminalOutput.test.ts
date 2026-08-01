import { describe, expect, it } from "vitest";
import { TerminalOutputQueue } from "./terminalOutput";

describe("TerminalOutputQueue", () => {
  it("flushes ordered chunks once per animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    const writes: string[] = [];
    const queue = new TerminalOutputQueue(
      (data) => writes.push(data),
      (callback) => {
        frames.push(callback);
        return frames.length;
      },
    );

    queue.push("one");
    queue.push("two");

    expect(frames).toHaveLength(1);
    expect(writes).toEqual([]);
    frames[0]?.(0);
    expect(writes).toEqual(["onetwo"]);
  });
});
