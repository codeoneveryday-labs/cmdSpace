import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./OrchestrationCanvasPanel.tsx", import.meta.url),
  "utf8",
);

describe("OrchestrationCanvasPanel contract", () => {
  it("keeps draft, approval, and runtime attachment controls inside Canvas", () => {
    expect(source).toContain("Agent orchestration");
    expect(source).toContain("Ask boss for draft");
    expect(source).toContain("Approve & Run");
    expect(source).toContain("createOrchestrationRuntime");
    expect(source).toContain("applyManifestToOrchestrationDiagram");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("onApplyRunRef");
    expect(source).toContain("createAgentChatRuntime");
    expect(source).toContain("extractOrchestrationProposal");
    expect(source).toContain("Save draft revision");
    expect(source).toContain("parseOrchestrationManifestJson");
    expect(source).toContain("Pause");
    expect(source).toContain("Resume run");
    expect(source).toContain("Retry");
    expect(source).toContain("freshWorkerTasksRef");
    expect(source).toContain("BOSS");
    expect(source).toContain("WORKER");
    expect(source).toContain("selectedTeamMember");
    expect(source).toContain("Team roster");
    expect(source).toContain("Mailbox");
    expect(source).toContain("Route outbox");
    expect(source).toContain("Reading as");
    expect(source).toContain("sendMail");
    expect(source).toContain("ackMail");
    expect(source).toContain("routeMail");
    expect(source).not.toContain('id="orchestration-provider"');
  });
});
