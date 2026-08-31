import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "AgentChatComposer.tsx",
);

describe("AgentChatComposer", () => {
  it("keeps textarea, attachments, and action-bar composition in one surface", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("onDraftChange");
    expect(source).toContain("onSubmit");
    expect(source).toContain("AgentComposerAttachments");
    expect(source).toContain("AgentComposerActionBar");
    expect(source).toContain("/commands and /skills");
    expect(source).toContain("event.key !== \"Enter\"");
  });
});
