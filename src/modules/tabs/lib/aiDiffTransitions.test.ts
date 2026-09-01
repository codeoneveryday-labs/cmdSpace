import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import { closeAiDiffState, openAiDiffState, updateAiDiffStatus } from "./aiDiffTransitions";

const tabs = [
  { id: 1, kind: "preview", title: "A", url: "https://a.test" },
  { id: 2, kind: "ai-diff", title: "diff", path: "a.ts", originalContent: "", proposedContent: "x", approvalId: "approval-1", status: "pending", isNewFile: false },
  { id: 3, kind: "preview", title: "B", url: "https://b.test" },
] as Tab[];

describe("aiDiffTransitions", () => {
  it("removes a non-final AI diff and selects the previous tab", () => {
    const result = closeAiDiffState(tabs, 2, "approval-1");
    expect(result.tabs.map((tab) => tab.id)).toEqual([1, 3]);
    expect(result.activeId).toBe(1);
  });

  it("approves instead of removing a final AI diff", () => {
    const only = [tabs[1]];
    const result = closeAiDiffState(only, 2, "approval-1");
    expect(result.tabs[0]).toMatchObject({ status: "approved" });
    expect(result.activeId).toBe(2);
  });

  it("updates only the matching approval", () => {
    const result = updateAiDiffStatus(tabs, "approval-1", "rejected");
    expect(result[1]).toMatchObject({ status: "rejected" });
    expect(result[0]).toEqual(tabs[0]);
  });

  it("dedupes an existing approval without consuming a new id", () => {
    let called = false;
    const result = openAiDiffState(tabs, { path: "b.ts", originalContent: "", proposedContent: "x", approvalId: "approval-1", isNewFile: false }, () => { called = true; return 99; });
    expect(result.targetId).toBe(2);
    expect(called).toBe(false);
  });
});
