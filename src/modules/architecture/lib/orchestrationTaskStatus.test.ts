import { describe, expect, it } from "vitest";

import { taskStatusDot } from "./orchestrationTaskStatus";

describe("taskStatusDot", () => {
  it("maps active and terminal task states onto header dots", () => {
    expect(taskStatusDot("running")).toBe("working");
    expect(taskStatusDot("validating")).toBe("working");
    expect(taskStatusDot("completed")).toBe("done");
    expect(taskStatusDot("failed")).toBe("blocked");
    expect(taskStatusDot("blocked")).toBe("blocked");
  });

  it("stays quiet for pending and settled-away states", () => {
    expect(taskStatusDot("queued")).toBeNull();
    expect(taskStatusDot("draft")).toBeNull();
    expect(taskStatusDot("cancelled")).toBeNull();
    expect(taskStatusDot("interrupted")).toBeNull();
    expect(taskStatusDot("paused")).toBeNull();
  });
});
