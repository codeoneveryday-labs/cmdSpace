import { afterEach, describe, expect, it } from "vitest";
import {
  broadcastTargetsForInput,
  clearBroadcastRuntime,
  registerBroadcastTab,
} from "./terminalBroadcastRuntime";

describe("terminal broadcast runtime", () => {
  afterEach(clearBroadcastRuntime);

  it("fans user input to selected live panes in the same tab", () => {
    registerBroadcastTab(10, [1, 2, 3], true, [1, 3]);
    expect(broadcastTargetsForInput(1, [1, 2, 3])).toEqual([1, 3]);
  });

  it("never loses the source and skips closed sessions", () => {
    registerBroadcastTab(10, [1, 2], true, [2]);
    expect(broadcastTargetsForInput(1, [1])).toEqual([1]);
  });
});
