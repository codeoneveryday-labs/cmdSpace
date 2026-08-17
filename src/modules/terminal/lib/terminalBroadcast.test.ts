import { describe, expect, it } from "vitest";
import { resolveBroadcastTargets } from "./terminalBroadcast";

describe("resolveBroadcastTargets", () => {
  it("returns only the source while broadcast is disabled", () => {
    expect(resolveBroadcastTargets(false, 1, [1, 2], [1, 2])).toEqual([1]);
  });

  it("deduplicates selected live targets and skips stale leaves", () => {
    expect(resolveBroadcastTargets(true, 1, [1, 2, 2, 99], [1, 2, 3])).toEqual([1, 2]);
  });

  it("keeps the source writable when it was not explicitly selected", () => {
    expect(resolveBroadcastTargets(true, 1, [2], [1, 2])).toEqual([1, 2]);
  });
});
