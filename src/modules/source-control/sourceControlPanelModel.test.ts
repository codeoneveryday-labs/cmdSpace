import { describe, expect, it } from "vitest";
import { deriveSourceControlPanelModel } from "./sourceControlPanelModel";

const summary = (busyAction: string | null = null) =>
  ({ busyAction }) as never;

describe("sourceControlPanelModel", () => {
  it("gates commit and remote actions from staged/message/upstream state", () => {
    const model = deriveSourceControlPanelModel(
      {
        stagedEntries: [{}],
        commitMessage: " ship it ",
        actionBusy: null,
        pushHint: null,
        status: { upstream: "origin/main", ahead: 0, behind: 2, isDetached: false },
      },
      summary(),
    );

    expect(model.canCommit).toBe(true);
    expect(model.canPull).toBe(true);
    expect(model.canFetch).toBe(true);
    expect(model.stagedCount).toBe(1);
  });

  it("blocks pull when history diverges and prioritizes action errors", () => {
    const model = deriveSourceControlPanelModel(
      {
        stagedEntries: [],
        commitMessage: "",
        actionBusy: "push",
        pushHint: "Push unavailable",
        status: { upstream: "origin/main", ahead: 1, behind: 1, isDetached: false },
        actionError: "commit failed",
        remoteError: "remote failed",
        actionMessage: "done",
      },
      summary("fetch"),
    );

    expect(model.canCommit).toBe(false);
    expect(model.canPull).toBe(false);
    expect(model.canFetch).toBe(false);
    expect(model.footerFeedback).toEqual({ tone: "error", message: "commit failed" });
  });
});
