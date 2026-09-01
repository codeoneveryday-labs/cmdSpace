import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type {
  ArchitectureTab,
  AiDiffTab,
  EditorTab,
  GitCommitFileDiffTab,
  GitDiffTab,
  GitHistoryTab,
  MarkdownTab,
  PreviewTab,
  TerminalTab,
} from "./tabTypes";

export function createTerminalTab({
  id,
  leafId,
  cwd,
  title = "shell",
  initialCommand,
  privateTab = false,
}: {
  id: number;
  leafId: number;
  cwd?: string;
  title?: string;
  initialCommand?: string;
  privateTab?: boolean;
}): TerminalTab {
  return {
    id,
    kind: "terminal",
    title,
    cwd,
    paneTree: privateTab
      ? { kind: "leaf", id: leafId, cwd }
      : {
          kind: "leaf",
          id: leafId,
          cwd,
          lastCommand: initialCommand,
          autoLaunch: Boolean(initialCommand),
        },
    activeLeafId: leafId,
    ...(privateTab ? { private: true } : {}),
  };
}

export function createWorkspaceTab({
  id,
  title,
  cwd,
  paneTree,
  activeLeafId,
}: {
  id: number;
  title: string;
  cwd?: string;
  paneTree: TerminalTab["paneTree"];
  activeLeafId: number;
}): TerminalTab {
  return { id, kind: "terminal", title, cwd, paneTree, activeLeafId };
}

export function createInitialTerminalTab({
  id,
  cwd,
  title = "shell",
  leafId,
}: {
  id: number;
  cwd?: string;
  title?: string;
  leafId: number;
}): TerminalTab {
  return {
    id,
    kind: "terminal",
    title,
    cwd,
    paneTree: { kind: "leaf", id: leafId, cwd },
    activeLeafId: leafId,
  };
}

export function createAgentChatTab({
  id,
  title,
  provider,
  cwd,
  chatId,
  nativeSessionId,
  initialDraft,
  initialHistoryAttachments,
}: {
  id: number;
  title: string;
  provider: CliAgent;
  cwd: string;
  chatId?: string;
  nativeSessionId?: string | null;
  initialDraft?: string;
  initialHistoryAttachments?: AgentChatHistoryAttachment[];
}) {
  return {
    id,
    chatId: chatId ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    kind: "agent-chat" as const,
    title,
    provider,
    cwd,
    nativeSessionId: nativeSessionId ?? null,
    initialDraft,
    initialHistoryAttachments,
  };
}

export function createEditorTab({ id, path, preview }: { id: number; path: string; preview: boolean }): EditorTab {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return {
    id,
    kind: "editor",
    title: parts.length ? parts[parts.length - 1] : path,
    path,
    dirty: false,
    preview,
  };
}

export function createPreviewTab(id: number, url: string): PreviewTab {
  let title = url || "preview";
  try { title = new URL(url).host || url; } catch { /* keep the raw URL */ }
  return { id, kind: "preview", title, url };
}

export function createMarkdownTab(id: number, path: string): MarkdownTab {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return { id, kind: "markdown", title: parts.length ? parts[parts.length - 1] : path, path };
}

export function createArchitectureTab(id: number, diagram?: ArchitectureTab["diagram"], title = "Architecture"): ArchitectureTab {
  return { id, kind: "architecture", title, ...(diagram ? { diagram } : {}) };
}

export function createGitDiffTab(input: {
  id: number;
  path: string;
  repoRoot: string;
  mode: "-" | "+";
  originalPath: string | null;
  title?: string;
}): GitDiffTab {
  return {
    id: input.id,
    kind: "git-diff",
    title: input.title ?? `${basename(input.path)} (${input.mode})`,
    path: input.path,
    repoRoot: input.repoRoot,
    mode: input.mode,
    originalPath: input.originalPath,
  };
}

export function createGitHistoryTab(id: number, repoRoot: string, branch?: string | null): GitHistoryTab {
  return { id, kind: "git-history", title: branch ? `History · ${branch}` : "Git History", repoRoot };
}

export function createGitCommitFileDiffTab(input: {
  id: number;
  repoRoot: string;
  sha: string;
  shortSha: string;
  subject: string;
  path: string;
  originalPath: string | null;
}): GitCommitFileDiffTab {
  return { ...input, kind: "git-commit-file", title: `${basename(input.path)} @ ${input.shortSha}` };
}

export function createAiDiffTab(input: {
  id: number;
  path: string;
  originalContent: string;
  proposedContent: string;
  approvalId: string;
  isNewFile: boolean;
}): AiDiffTab {
  return {
    ...input,
    kind: "ai-diff",
    title: `${basename(input.path)} (AI diff)`,
    status: "pending",
  };
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}
