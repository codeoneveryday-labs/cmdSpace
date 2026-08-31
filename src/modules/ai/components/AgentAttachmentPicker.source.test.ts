import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentAttachmentPicker.tsx", import.meta.url),
  "utf8",
);

describe("AgentAttachmentPicker contract", () => {
  it("keeps file, image and URL attachment entry points together", () => {
    expect(source).toContain("export function AgentAttachmentPicker");
    expect(source).toContain("Add image");
    expect(source).toContain("Upload file");
    expect(source).toContain("Add issue or PR");
    expect(source).toContain("Attach URL");
    expect(source).toContain("accept=\"image/*\"");
  });
});
