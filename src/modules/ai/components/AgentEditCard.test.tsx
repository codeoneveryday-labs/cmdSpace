import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentEditCard } from "./AgentEditCard";

const files = [
  "docs/plans/active/2026-08-29-agent-runtime-daemon.md",
  "src/modules/ai/lib/agentChatStartup.test.ts",
  "src/modules/ai/lib/agentChatStartup.ts",
  "src/modules/ai/hooks/useAgentChatSession.ts",
  "src/modules/ai/hooks/useAgentChatControls.ts",
].map((path, index) => ({
  path,
  originalPath: null,
  repoRoot: "/workspace",
  added: (index + 1) * 10,
  removed: index,
  untracked: false,
}));

describe("AgentEditCard", () => {
  it("shows a compact three-file preview with an expandable remainder", () => {
    const markup = renderToStaticMarkup(
      <AgentEditCard files={files} onReview={() => undefined} onUndo={() => undefined} />,
    );

    expect(markup).toContain("Edited 5 files");
    expect(markup).toContain("Show 2 more files");
    expect(markup).toContain(files[0]!.path);
    expect(markup).toContain(files[2]!.path);
    expect(markup).not.toContain(files[3]!.path);
    expect(markup).toContain("Undo");
    expect(markup).toContain("Review");
  });
});
