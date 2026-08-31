import { describe, expect, it } from "vitest";
import {
  calculateAssignedCliTerminals,
  calculateCliTerminalCapacity,
  calculateRemainingAgentSlots,
  clampAgentCount,
  pruneAgentCountsToCapacity,
} from "./workspaceAgentAssignmentModel";

describe("workspaceAgentAssignmentModel", () => {
  it("calculates totals, capacities, and remaining slots", () => {
    const counts = { claude: 2, codex: 1 };
    expect(calculateAssignedCliTerminals(counts)).toBe(3);

    // Total 6 terminals, 1 import session
    expect(calculateCliTerminalCapacity(6, 1)).toBe(5);
    expect(calculateRemainingAgentSlots(6, 1, 3)).toBe(2);
  });

  it("clamps requested agent count within available capacity", () => {
    const current = { claude: 2 };
    // capacity is 4, otherCount is 0, so asking for 3 yields 3
    expect(clampAgentCount("claude", 3, current, 4)).toBe(3);
    // asking for 5 clamped to 4
    expect(clampAgentCount("claude", 5, current, 4)).toBe(4);
    // asking for negative clamped to 0
    expect(clampAgentCount("claude", -1, current, 4)).toBe(0);

    // otherCount is 2 (claude: 2), asking for codex with capacity 3 clamped to 1
    expect(clampAgentCount("codex", 2, current, 3)).toBe(1);
  });

  it("prunes agent counts when capacity shrinks", () => {
    const current = { claude: 3, codex: 2 };
    const allowed = ["claude", "codex", "gemini"];
    const pruned = pruneAgentCountsToCapacity(current, 4, allowed);

    expect(pruned).toEqual({ claude: 3, codex: 1 });
  });
});
