import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/ai/tools/orchestration.ts"),
  "utf8",
);

describe("Helper orchestration tools", () => {
  it("keeps app-level mutations behind approval", () => {
    expect(source).toContain("execute_plan: tool({");
    expect(source).toContain("create_workspace: tool({");
    expect(source).toContain("open_architecture: tool({");
    expect(source).toContain("open_browser: tool({");
    expect(source.match(/needsApproval: true/g)?.length).toBe(5);
  });

  it("creates every requested pane with the same startup command", () => {
    expect(source).toContain(
      "Array.from({ length: input.terminal_count }, () => command)",
    );
    expect(source).toContain("terminal_count: z.number().int().min(1).max(12)");
  });

  it("supports one auto-launched CLI per terminal pane", () => {
    expect(source).toContain('const agentCli = z.enum(["claude", "codex", "opencode", "gemini", "kimi", "grok"])');
    expect(source).toContain("agent_commands");
    expect(source).toContain("AGENT_CLI_COMMANDS[agent]");
    expect(source).toContain("agent_commands must contain exactly");
    expect(source).toContain("initialCommandsForWorkspace(input)");
    expect(source).not.toContain("isolatedAgentCommand");
    expect(source).not.toContain("git worktree");
    expect(source).not.toContain("npm install");
    expect(source).not.toContain("expect -c");
    expect(source).not.toContain("CODEX_CONFIG");
  });

  it("builds an editable node and edge graph for a mind map", () => {
    expect(source).toContain("create_mindmap: tool({");
    expect(source).toContain("buildMindMapDiagram");
    expect(source).toContain("subtreeHeights");
    expect(source).toContain("childrenStartY");
    expect(source).toContain("const childGap = 16");
    expect(source).toContain('kind: \"circle\"');
    expect(source).toContain("mindmap-edge-center");
  });
});
