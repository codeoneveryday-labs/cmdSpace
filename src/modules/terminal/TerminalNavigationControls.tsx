import { cn } from "@/lib/utils";
import { native } from "@/modules/ai/lib/native";
import { listTerminalSubdirectories } from "./lib/terminal-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { VirtualizedDropdownList } from "@/components/ui/virtualized-dropdown-list";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { wouldCheckoutReloadDevApp } from "@/modules/git/devReloadGuard";
import { emitGitRepoChanged } from "@/modules/git/events";

type Props = {
  cwd?: string;
  onChangeDirectory: (path: string) => void;
  className?: string;
};

function dirname(path: string): string {
  const clean = path.replace(/\/$/, "");
  const index = clean.lastIndexOf("/");
  return index <= 0 ? "/" : clean.slice(0, index);
}

function joinPath(base: string, name: string): string {
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function TerminalNavigationControls({
  cwd,
  onChangeDirectory,
  className,
}: Props) {
  const showHidden = usePreferencesStore((state) => state.showHidden);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [directories, setDirectories] = useState<string[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const folderName = cwd?.replace(/\/$/, "").split("/").pop() || "terminal";
  const parentPath = cwd ? dirname(cwd) : null;

  const refreshRepository = useCallback(async () => {
    if (!cwd) {
      setBranchName(null);
      setRepoRoot(null);
      return;
    }
    try {
      const repo = await native.gitResolveRepo(cwd);
      setBranchName(repo?.branch ?? null);
      setRepoRoot(repo?.repoRoot ?? null);
    } catch {
      setBranchName(null);
      setRepoRoot(null);
    }
  }, [cwd]);

  useEffect(() => {
    void refreshRepository();
  }, [refreshRepository]);

  useEffect(() => {
    if (!directoryOpen && !branchOpen) return;
    const closeWhenOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDirectoryOpen(false);
        setBranchOpen(false);
      }
    };
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, [branchOpen, directoryOpen]);

  const openDirectories = async () => {
    if (!cwd) return;
    setDirectoryError(null);
    setBranchOpen(false);
    setDirectoryOpen(true);
    try {
      const list = await listTerminalSubdirectories(cwd, showHidden);
      setDirectories(list);
    } catch (error) {
      setDirectoryError(String(error));
      setDirectories([]);
    }
  };

  const openBranches = async () => {
    if (!repoRoot) return;
    setDirectoryOpen(false);
    setCheckoutError(null);
    try {
      const result = await native.runCommand(
        'git branch --format="%(refname:short)"',
        repoRoot,
      );
      if (result.exit_code !== 0) return;
      setBranches(result.stdout.split("\n").map((branch) => branch.trim()).filter(Boolean));
      setBranchOpen(true);
    } catch (error) {
      console.warn("Failed to list branches:", error);
    }
  };

  const selectBranch = async (branch: string) => {
    if (!repoRoot || branch === branchName) return;
    setCheckoutError(null);
    try {
      const appDevRepoRoot = await native.appDevRepoRoot().catch(() => null);
      if (wouldCheckoutReloadDevApp(repoRoot, appDevRepoRoot, import.meta.env.DEV)) {
        setCheckoutError(
          "Switching this dev app repo would reload cmdSpace. Use a separate worktree for branch testing.",
        );
        return;
      }
      const result = await native.runCommand(
        `git checkout ${shellQuote(branch)}`,
        repoRoot,
      );
      if (result.exit_code !== 0) {
        console.warn("Git checkout failed:", result.stderr);
        return;
      }
      setBranchOpen(false);
      emitGitRepoChanged(repoRoot);
      void refreshRepository();
    } catch (error) {
      console.warn("Git checkout failed:", error);
    }
  };

  return (
    <div ref={dropdownRef} className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="relative min-w-0">
        <button
          type="button"
          data-directory-picker="inline"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (directoryOpen) setDirectoryOpen(false);
            else void openDirectories();
          }}
          className="max-w-40 truncate text-left font-semibold text-foreground transition-colors hover:text-foreground/80 dark:text-zinc-300 dark:hover:text-zinc-100"
          aria-label="Choose terminal folder"
          title={cwd}
        >
          {folderName}
        </button>
        {directoryOpen && cwd ? (
          <div className="absolute left-0 top-full z-40 mt-2.5 w-56 rounded-lg border border-border bg-popover/95 p-0 text-left text-popover-foreground shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
            {parentPath ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChangeDirectory(parentPath);
                  setDirectoryOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <span className="w-3.5 text-center text-muted-foreground">↑</span>
                .. (Parent Directory)
              </button>
            ) : null}
            {directoryError ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{directoryError}</div>
            ) : directories.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No subfolders</div>
            ) : (
              <VirtualizedDropdownList
                items={directories}
                className="max-h-64 w-56 overflow-y-scroll"
                keyExtractor={(directory) => directory}
                renderItem={(directory) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChangeDirectory(joinPath(cwd, directory));
                      setDirectoryOpen(false);
                    }}
                    className="flex h-full w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{directory}</span>
                  </button>
                )}
              />
            )}
          </div>
        ) : null}
      </div>
      {branchName ? (
        <>
          <span className="font-bold text-muted-foreground/60 dark:text-zinc-600">•</span>
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (branchOpen) setBranchOpen(false);
                else void openBranches();
              }}
              className="inline-flex max-w-40 items-center gap-1.5 truncate font-semibold text-foreground transition-colors hover:text-foreground/80 dark:text-zinc-300 dark:hover:text-zinc-100"
              aria-label="Choose Git branch"
              title={branchName}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span className="truncate">{branchName}</span>
            </button>
            {branchOpen ? (
              <div className="absolute left-0 top-full z-40 mt-2.5 w-56 rounded-lg border border-border bg-popover/95 p-0 text-left text-popover-foreground shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
                {checkoutError ? <div className="border-b border-border/70 px-3 py-2 text-xs font-medium leading-snug text-amber-700 dark:border-zinc-800 dark:text-amber-300">{checkoutError}</div> : null}
                {branches.length === 0 ? <div className="px-3 py-2 text-xs text-muted-foreground">No branches found</div> : (
                  <VirtualizedDropdownList
                    items={branches}
                    className="max-h-64 w-56 overflow-y-scroll rounded-lg"
                    keyExtractor={(branch) => branch}
                    renderItem={(branch) => (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void selectBranch(branch);
                        }}
                        className={cn(
                          "flex h-full w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors",
                          branch === branchName
                            ? "bg-muted text-foreground dark:bg-zinc-900 dark:text-zinc-300"
                            : "text-foreground hover:bg-muted dark:text-zinc-300 dark:hover:bg-zinc-900",
                        )}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                          <line x1="6" y1="3" x2="6" y2="15" />
                          <circle cx="18" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <path d="M18 9a9 9 0 0 1-9 9" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">{branch}</span>
                      </button>
                    )}
                  />
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
