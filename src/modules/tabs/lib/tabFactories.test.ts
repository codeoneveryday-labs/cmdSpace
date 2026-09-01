import { describe, expect, it } from "vitest";
import { createAgentChatTab, createAiDiffTab, createArchitectureTab, createEditorTab, createGitCommitFileDiffTab, createGitDiffTab, createGitHistoryTab, createInitialTerminalTab, createMarkdownTab, createPreviewTab, createTerminalTab, createWorkspaceTab } from "./tabFactories";

describe("tabFactories", () => {
  it("creates terminal and private tabs with the expected pane metadata", () => {
    expect(createTerminalTab({ id: 1, leafId: 2, cwd: "/repo", initialCommand: "npm test" }).paneTree).toMatchObject({
      kind: "leaf",
      lastCommand: "npm test",
      autoLaunch: true,
    });
    expect(createWorkspaceTab({ id: 5, title: "workspace", cwd: "/repo", paneTree: { kind: "leaf", id: 6 }, activeLeafId: 6 })).toMatchObject({ kind: "terminal", title: "workspace" });
    expect(createInitialTerminalTab({ id: 10, leafId: 11, cwd: "/repo" })).toMatchObject({ kind: "terminal", title: "shell" });
    expect(createTerminalTab({ id: 3, leafId: 4, privateTab: true }).paneTree).not.toHaveProperty("autoLaunch");
  });

  it("creates agent-chat and editor tabs with normalized defaults", () => {
    expect(createAgentChatTab({ id: 1, title: "Chat", provider: "codex", cwd: "/repo", chatId: "chat-1" })).toMatchObject({
      kind: "agent-chat",
      nativeSessionId: null,
      chatId: "chat-1",
    });
    expect(createEditorTab({ id: 2, path: "/repo/README.md", preview: true })).toMatchObject({
      title: "README.md",
      preview: true,
    });
    expect(createPreviewTab(3, "https://example.test/docs")).toMatchObject({ title: "example.test" });
    expect(createMarkdownTab(4, "/repo/README.md")).toMatchObject({ title: "README.md" });
    expect(createArchitectureTab(5)).toMatchObject({ kind: "architecture", title: "Architecture" });
    expect(createGitDiffTab({ id: 6, path: "/repo/a.ts", repoRoot: "/repo", mode: "-", originalPath: null })).toMatchObject({ title: "a.ts (-)" });
    expect(createGitHistoryTab(7, "/repo", "main")).toMatchObject({ title: "History · main" });
    expect(createGitCommitFileDiffTab({ id: 8, repoRoot: "/repo", sha: "abc", shortSha: "abc", subject: "Fix", path: "/repo/a.ts", originalPath: null })).toMatchObject({ title: "a.ts @ abc" });
    expect(createAiDiffTab({ id: 9, path: "/repo/a.ts", originalContent: "", proposedContent: "x", approvalId: "approval", isNewFile: true })).toMatchObject({ title: "a.ts (AI diff)", status: "pending" });
  });
});
