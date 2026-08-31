import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentComposerActionBar.tsx", import.meta.url),
  "utf8",
);

describe("AgentComposerActionBar contract", () => {
  it("coordinates composer controls without owning draft or session state", () => {
    expect(source).toContain("export function AgentComposerActionBar");
    expect(source).toContain("AgentAttachmentPicker");
    expect(source).toContain("AgentModelPicker");
    expect(source).toContain("Steer agent with this prompt");
    expect(source).toContain("Cancel agent turn");
    expect(source).toContain("onSend");
  });
});
