import type { PaneNode } from "@/modules/terminal/lib/panes";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";

export type TerminalTab = {
  id: number;
  kind: "terminal";
  title: string;
  cwd?: string;
  paneTree: PaneNode;
  activeLeafId: number;
  private?: boolean;
  maximizedLeafId?: number;
};

export type EditorTab = {
  id: number;
  kind: "editor";
  title: string;
  path: string;
  dirty: boolean;
  preview: boolean;
};

export type MarkdownTab = { id: number; kind: "markdown"; title: string; path: string };
export type AiDiffStatus = "pending" | "approved" | "rejected";

export type AiDiffTab = {
  id: number;
  kind: "ai-diff";
  title: string;
  path: string;
  originalContent: string;
  proposedContent: string;
  approvalId: string;
  status: AiDiffStatus;
  isNewFile: boolean;
};

export type GitDiffTab = { id: number; kind: "git-diff"; title: string; path: string; repoRoot: string; mode: "-" | "+"; originalPath: string | null };
export type GitHistoryTab = { id: number; kind: "git-history"; title: string; repoRoot: string };
export type ArchitectureTab = { id: number; kind: "architecture"; title: string; diagram?: ArchitectureDiagram };

export type AgentChatTab = {
  id: number;
  chatId: string;
  kind: "agent-chat";
  title: string;
  provider: CliAgent;
  cwd: string;
  nativeSessionId: string | null;
  initialDraft?: string;
  initialHistoryAttachments?: AgentChatHistoryAttachment[];
};

export type ArchitectureShapeKind = "actor" | "external" | "service" | "api" | "worker" | "function" | "ai" | "database" | "cache" | "queue" | "storage" | "gateway" | "security" | "boundary" | "rectangle" | "circle" | "frame" | "text" | "image" | "terminal" | "editor" | "line" | "arrow" | "pen";
export type ArchitectureDiagramNode = { id: string; kind: ArchitectureShapeKind; label: string; technology: string; x: number; y: number; width: number; height: number; rotation?: number; locked?: boolean; imageUrl?: string; cwd?: string; initialCommand?: string; nativeSessionId?: string; path?: string; terminalChromeVersion?: 2; points?: Array<{ x: number; y: number }>; connectorStartId?: string; connectorEndId?: string; textAnchorId?: string; frameId?: string };
export type ArchitectureTerminalDockTabs = { id: string; kind: "tabs"; terminalIds: string[]; activeTerminalId: string };
export type ArchitectureTerminalDockSplit = { id: string; kind: "split"; direction: "horizontal" | "vertical"; ratio: number; first: ArchitectureTerminalDockNode; second: ArchitectureTerminalDockNode };
export type ArchitectureTerminalDockNode = ArchitectureTerminalDockTabs | ArchitectureTerminalDockSplit;
export type ArchitectureTerminalDockGroup = { id: string; x: number; y: number; width: number; height: number; root: ArchitectureTerminalDockNode };
export type ArchitectureDiagramEdge = { id: string; from: string; to: string; label: string; locked?: boolean };
export type ArchitectureDiagram = { nodes: ArchitectureDiagramNode[]; edges: ArchitectureDiagramEdge[]; terminalDockGroups?: ArchitectureTerminalDockGroup[] };
export type GitCommitFileDiffTab = { id: number; kind: "git-commit-file"; title: string; repoRoot: string; sha: string; shortSha: string; subject: string; path: string; originalPath: string | null };

export type Tab = TerminalTab | EditorTab | MarkdownTab | AiDiffTab | GitDiffTab | GitHistoryTab | ArchitectureTab | AgentChatTab | GitCommitFileDiffTab;
export type TabPatch = Partial<{ title: string; cwd: string; diagram: ArchitectureDiagram; path: string; dirty: boolean; nativeSessionId: string | null; initialDraft: string }>;
