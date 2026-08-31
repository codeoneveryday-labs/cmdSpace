import { describe, expect, it } from "vitest";

import { createDirectoryRequestTracker } from "./directoryRequestTracker";

describe("directory request tracker", () => {
  it("rejects an older response once the same directory is requested again", () => {
    const tracker = createDirectoryRequestTracker();
    const first = tracker.begin("/repo/src");
    const second = tracker.begin("/repo/src");

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });

  it("rejects outstanding responses after the tree resets", () => {
    const tracker = createDirectoryRequestTracker();
    const stale = tracker.begin("/first-workspace");

    tracker.reset();
    const current = tracker.begin("/second-workspace");

    expect(tracker.isCurrent(stale)).toBe(false);
    expect(tracker.isCurrent(current)).toBe(true);
  });

  it("keeps simultaneous requests for different directories current", () => {
    const tracker = createDirectoryRequestTracker();
    const source = tracker.begin("/repo/src");
    const tests = tracker.begin("/repo/tests");

    expect(tracker.isCurrent(source)).toBe(true);
    expect(tracker.isCurrent(tests)).toBe(true);
  });
});
