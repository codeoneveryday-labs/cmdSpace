export type ToolContext = {
  /** Active terminal tab cwd, used to resolve relative paths. Null = home. */
  getCwd: () => string | null;
  /** Workspace root (explorer root). Used by tools that operate over the project. */
  getWorkspaceRoot: () => string | null;
  /** Last N lines of the active terminal buffer (or null if not a terminal tab). */
  getTerminalContext: () => string | null;
  isActiveTerminalPrivate: () => boolean;
  /**
   * Type a string into the active terminal at the prompt — without executing.
   * Returns false if there is no active terminal tab to inject into.
   */
  injectIntoActivePty: (text: string) => boolean;
  getActiveTerminalAgents: () => Array<{
    paneIndex: number;
    cwd: string | null;
    lastCommand: string | null;
    available: boolean;
  }>;
  /** Pane index that currently owns keyboard focus, or null when unavailable. */
  getActiveTerminalPaneIndex: () => number | null;
  dispatchPromptsToTerminals: (
    assignments: Array<{ paneIndex: number; prompt: string }>,
  ) => { paneIndex: number; sent: boolean; error?: string }[];
  /** Open a new preview tab (in-app iframe) at the given URL. */
  openPreview: (url: string) => boolean;
  createWorkspace: (input: {
    name?: string;
    folder: string;
    terminalCount: number;
    initialCommands: string[];
  }) => Promise<{ workspaceId?: string; tabId?: number; terminalCount: number }>;
  openBrowser: (url: string) => boolean;
  openArchitecture: () => boolean;
  createMindMap: (input: {
    title: string;
    diagram: import("@/modules/tabs").ArchitectureDiagram;
  }) => Promise<{ tabId: number; nodeCount: number; edgeCount: number }>;
  readCache: Map<string, { size: number; hash: number }>;
  /** Active chat session id — used by tools that persist per-session state (todos). */
  getSessionId: () => string | null;
};

export function resolvePath(rawPath: string, cwd: string | null): string {
  if (rawPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(rawPath))
    return rawPath;
  if (!cwd)
    throw new Error(
      `cannot resolve relative path "${rawPath}": no active terminal cwd. Pass an absolute path.`,
    );
  const sep = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/";
  return cwd.endsWith(sep) ? `${cwd}${rawPath}` : `${cwd}${sep}${rawPath}`;
}
