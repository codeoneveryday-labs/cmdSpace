import type { GitChangedFile, GitStatusSnapshot } from "@/modules/ai/lib/native";

export type DiffMode = "+" | "-";

export type SourceControlEntry = {
  key: string;
  path: string;
  mode: DiffMode;
  indexStatus: string;
  worktreeStatus: string;
  statusLabel: string;
  statusCode: string;
  originalPath: string | null;
  untracked: boolean;
};

export type CheckState = "checked" | "indeterminate" | "unchecked";

/** One row per changed file, merging its staged and unstaged representations. */
export type SourceControlFileEntry = {
  key: string;
  path: string;
  originalPath: string | null;
  statusCode: string;
  statusLabel: string;
  checkState: CheckState;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
};

function normalizeStatusCode(status: string): string {
  const code = status.trim().toUpperCase();
  switch (code) {
    case "?":
    case "U":
      return "U";
    case "A":
    case "M":
    case "D":
      return code;
    case "R":
    case "C":
      return "R";
    default:
      return code || "M";
  }
}

function statusCodeForMode(mode: DiffMode, file: GitChangedFile): string {
  if (mode === "-" && file.untracked) return "U";
  const primary = mode === "+" ? file.indexStatus : file.worktreeStatus;
  const fallback = mode === "+" ? file.worktreeStatus : file.indexStatus;
  return normalizeStatusCode(primary !== " " ? primary : fallback);
}

function makeEntry(
  path: string,
  mode: DiffMode,
  file: GitChangedFile,
): SourceControlEntry {
  return {
    key: `${mode}:${path}`,
    path,
    mode,
    indexStatus: file.indexStatus,
    worktreeStatus: file.worktreeStatus,
    statusLabel: file.statusLabel,
    statusCode: statusCodeForMode(mode, file),
    originalPath: file.originalPath,
    untracked: file.untracked,
  };
}

export function buildSourceControlEntries(status: GitStatusSnapshot | null): {
  stagedEntries: SourceControlEntry[];
  unstagedEntries: SourceControlEntry[];
  fileEntries: SourceControlFileEntry[];
  headerCheckState: CheckState;
  allClean: boolean;
} {
  const changedFiles = status?.changedFiles ?? [];
  const stagedEntries = changedFiles
    .filter((file) => file.staged)
    .map((file) => makeEntry(file.path, "+", file));
  const unstagedEntries = changedFiles
    .filter((file) => file.unstaged)
    .map((file) => makeEntry(file.path, "-", file));
  const seenPaths = new Set<string>();
  const fileEntries = changedFiles.flatMap((file) => {
    if (seenPaths.has(file.path)) return [];
    seenPaths.add(file.path);
    const checkState: CheckState = file.staged && file.unstaged
      ? "indeterminate"
      : file.staged
        ? "checked"
        : "unchecked";
    return [{
      key: file.path,
      path: file.path,
      originalPath: file.originalPath,
      statusCode: statusCodeForMode(file.unstaged ? "-" : "+", file),
      statusLabel: file.statusLabel,
      checkState,
      staged: file.staged,
      unstaged: file.unstaged,
      untracked: file.untracked,
    }];
  });
  const headerCheckState: CheckState = fileEntries.length === 0
    ? "unchecked"
    : fileEntries.every((entry) => entry.checkState === "checked")
      ? "checked"
      : fileEntries.some((entry) => entry.staged)
        ? "indeterminate"
        : "unchecked";

  return {
    stagedEntries,
    unstagedEntries,
    fileEntries,
    headerCheckState,
    allClean: stagedEntries.length === 0 && unstagedEntries.length === 0,
  };
}
