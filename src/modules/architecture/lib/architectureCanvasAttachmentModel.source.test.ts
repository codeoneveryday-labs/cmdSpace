import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureCanvasAttachmentModel.ts", import.meta.url),
  "utf8",
);

describe("architectureCanvasAttachmentModel contract", () => {
  it("centralizes text/frame snapping and attached dock-group movement", () => {
    expect(source).toContain("snapTextAttachment");
    expect(source).toContain("snapTerminalFrame");
    expect(source).toContain("attachedTerminalGroupIdsForFrameMove");
    expect(source).toContain("moveTerminalDockGroups");
    expect(source).toContain("TEXT_ATTACH_DISTANCE");
  });
});
