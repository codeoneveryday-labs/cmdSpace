import {
  native,
  type GitRepoInfo,
  type GitStatusSnapshot,
} from "@/modules/ai/lib/native";
import {
  GIT_REPO_CHANGED_EVENT,
  gitRepoRootFromChangedEvent,
  pathBelongsToRepo,
} from "@/modules/git/events";
import { useWorkspaceEnvStore, workspaceScopeKey } from "@/modules/workspace";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getContextualRemoteAction,
  performSourceControlRemoteAction,
  type SourceControlRemoteAction,
  type SourceControlRemoteActionMode,
  type SourceControlRemoteActionResult,
} from "./sourceControlRemoteActionExecution";

const AUTO_FETCH_THROTTLE_MS = 5 * 60_000;
const AUTO_FETCH_LRU_LIMIT = 16;
const FOCUS_REFRESH_MIN_INTERVAL_MS = 1500;

export type SourceControlRefreshMode = "auto" | "always" | "never";
export type {
  SourceControlRemoteAction,
  SourceControlRemoteActionMode,
  SourceControlRemoteActionResult,
} from "./sourceControlRemoteActionExecution";

export type SourceControlSummary = {
  repo: GitRepoInfo | null;
  status: GitStatusSnapshot | null;
  changedCount: number;
  upstream: string | null;
  ahead: number;
  behind: number;
  hasRepo: boolean;
  isLoading: boolean;
  localError: string | null;
  busyAction: SourceControlRemoteAction | null;
  lastRemoteError: string | null;
  applyStatus: (
    updater: (status: GitStatusSnapshot) => GitStatusSnapshot,
  ) => void;
  refresh: (options?: {
    remote?: SourceControlRefreshMode;
  }) => Promise<void>;
  runRemoteAction: (
    mode?: SourceControlRemoteActionMode,
  ) => Promise<SourceControlRemoteActionResult>;
};

export type SourceControlRemoteIndicator = {
  visible: boolean;
  label: string;
  title: string;
  disabled: boolean;
  action: SourceControlRemoteAction | null;
};

type SourceControlSummaryState = {
  repo: GitRepoInfo | null;
  status: GitStatusSnapshot | null;
  hasRepo: boolean;
  isLoading: boolean;
  localError: string | null;
  busyAction: SourceControlRemoteAction | null;
  lastRemoteError: string | null;
};

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown source control error";
}

export function getSourceControlRemoteIndicator(
  summary: Pick<
    SourceControlSummary,
    "hasRepo" | "upstream" | "ahead" | "behind" | "busyAction"
  >,
): SourceControlRemoteIndicator {
  if (!summary.hasRepo || !summary.upstream) {
    return { visible: false, label: "", title: "", disabled: true, action: null };
  }
  if (summary.ahead > 0 && summary.behind > 0) {
    return {
      visible: true,
      label: `↑${summary.ahead} ↓${summary.behind}`,
      title:
        "Branch has diverged from upstream. Use Source Control or the terminal to resolve it.",
      disabled: true,
      action: null,
    };
  }
  if (summary.behind > 0) {
    return {
      visible: true,
      label: `↓${summary.behind}`,
      title: `Pull ${summary.behind} remote ${
        summary.behind === 1 ? "commit" : "commits"
      } with fast-forward only.`,
      disabled: summary.busyAction !== null,
      action: "pull",
    };
  }
  if (summary.ahead > 0) {
    return {
      visible: true,
      label: `↑${summary.ahead}`,
      title: `Push ${summary.ahead} local ${
        summary.ahead === 1 ? "commit" : "commits"
      }.`,
      disabled: summary.busyAction !== null,
      action: "push",
    };
  }
  return {
    visible: true,
    label: "Sync",
    title: "Fetch remote updates.",
    disabled: summary.busyAction !== null,
    action: "fetch",
  };
}

function touchAutoFetch(map: Map<string, number>, key: string): void {
  map.delete(key);
  map.set(key, Date.now());
  while (map.size > AUTO_FETCH_LRU_LIMIT) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function useSourceControl(
  contextPath: string | null,
  enabled: boolean = true,
): SourceControlSummary {
  const workspaceEnv = useWorkspaceEnvStore((s) => s.env);
  const workspaceKey = workspaceScopeKey(workspaceEnv);
  const [state, setState] = useState<SourceControlSummaryState>({
    repo: null,
    status: null,
    hasRepo: false,
    isLoading: false,
    localError: null,
    busyAction: null,
    lastRemoteError: null,
  });
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const inflightRef = useRef<Promise<void> | null>(null);
  const inflightModeRef = useRef<SourceControlRefreshMode>("never");
  const autoFetchByRepoRef = useRef(new Map<string, number>());
  const enabledRef = useRef(enabled);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    requestIdRef.current++;
    inflightRef.current = null;
    inflightModeRef.current = "never";
    autoFetchByRepoRef.current.clear();
    setState({
      repo: null,
      status: null,
      hasRepo: false,
      isLoading: false,
      localError: null,
      busyAction: null,
      lastRemoteError: null,
    });
  }, [workspaceKey]);

  const applyStatus = useCallback(
    (updater: (status: GitStatusSnapshot) => GitStatusSnapshot) => {
      setState((current) => {
        if (!current.status) return current;
        const next = updater(current.status);
        if (next === current.status) return current;
        return { ...current, status: next };
      });
    },
    [],
  );

  const doRefresh = useCallback(
    async (remoteMode: SourceControlRefreshMode): Promise<void> => {
      if (!enabledRef.current) return;
      const requestId = ++requestIdRef.current;

      if (!contextPath) {
        setState({
          repo: null,
          status: null,
          hasRepo: false,
          isLoading: false,
          localError: null,
          busyAction: null,
          lastRemoteError: null,
        });
        return;
      }

      const activeRoot = stateRef.current.repo?.repoRoot ?? null;
      const reusableRoot =
        activeRoot &&
        (contextPath === activeRoot || contextPath.startsWith(`${activeRoot}/`))
          ? activeRoot
          : undefined;

      setState((current) => ({ ...current, isLoading: true, localError: null }));

      try {
        let repo: GitRepoInfo | null;
        let status: GitStatusSnapshot | null;

        if (reusableRoot) {
          try {
            repo = stateRef.current.repo ?? null;
            status = await native.gitStatus(reusableRoot);
            if (requestId !== requestIdRef.current) return;
            if (!repo || repo.repoRoot !== reusableRoot) {
              repo = {
                repoRoot: reusableRoot,
                branch: status.branch,
                upstream: status.upstream,
                isDetached: status.isDetached,
              };
            }
          } catch {
            const snapshot = await native.gitPanelSnapshot(contextPath);
            if (requestId !== requestIdRef.current) return;
            if (!snapshot.repo) {
              setState((current) => ({
                ...current,
                repo: null,
                status: null,
                hasRepo: false,
                isLoading: false,
                localError: null,
              }));
              return;
            }
            repo = snapshot.repo;
            status = snapshot.status ?? null;
          }
        } else {
          const snapshot = await native.gitPanelSnapshot(contextPath);
          if (requestId !== requestIdRef.current) return;
          if (!snapshot.repo) {
            setState((current) => ({
              ...current,
              repo: null,
              status: null,
              hasRepo: false,
              isLoading: false,
              localError: null,
            }));
            return;
          }
          repo = snapshot.repo;
          status = snapshot.status ?? null;
        }

        if (!repo) {
          setState((current) => ({
            ...current,
            repo: null,
            status: null,
            hasRepo: false,
            isLoading: false,
            localError: null,
          }));
          return;
        }

        let nextRemoteError = stateRef.current.lastRemoteError;
        const shouldAutoFetch =
          repo.upstream &&
          remoteMode !== "never" &&
          (remoteMode === "always" ||
            Date.now() -
              (autoFetchByRepoRef.current.get(repo.repoRoot) ?? 0) >=
              AUTO_FETCH_THROTTLE_MS);

        if (shouldAutoFetch) {
          try {
            await native.gitFetch(repo.repoRoot);
            touchAutoFetch(autoFetchByRepoRef.current, repo.repoRoot);
            nextRemoteError = null;
            if (requestId !== requestIdRef.current) return;
            status = await native.gitStatus(repo.repoRoot);
            if (requestId !== requestIdRef.current) return;
          } catch (error) {
            nextRemoteError = normalizeError(error);
          }
        }

        setState((current) => ({
          ...current,
          repo,
          status,
          hasRepo: true,
          isLoading: false,
          localError: null,
          lastRemoteError: nextRemoteError,
        }));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          repo: null,
          hasRepo: false,
          status: null,
          isLoading: false,
          localError: normalizeError(error),
        }));
      } finally {
        lastRefreshAtRef.current = Date.now();
      }
    },
    [contextPath, workspaceKey],
  );

  const refresh = useCallback(
    async (options?: { remote?: SourceControlRefreshMode }) => {
      const remoteMode = options?.remote ?? "never";
      const inflight = inflightRef.current;
      if (inflight) {
        const cur = inflightModeRef.current;
        const upgrade =
          (cur === "never" && remoteMode !== "never") ||
          (cur === "auto" && remoteMode === "always");
        if (!upgrade) return inflight;
      }
      inflightModeRef.current = remoteMode;
      const run = doRefresh(remoteMode).finally(() => {
        if (inflightRef.current === run) {
          inflightRef.current = null;
          inflightModeRef.current = "never";
        }
      });
      inflightRef.current = run;
      return run;
    },
    [doRefresh],
  );

  const runRemoteAction = useCallback(
    async (
      mode: SourceControlRemoteActionMode = "contextual",
    ): Promise<SourceControlRemoteActionResult> => {
      const { repo, status } = stateRef.current;
      if (!repo || !status) {
        return { ok: false, action: null, blocked: "no-repo" };
      }
      if (!status.upstream) {
        return { ok: false, action: null, blocked: "missing-upstream" };
      }

      const action = mode === "contextual" ? getContextualRemoteAction(status) : mode;
      if (!action) {
        return { ok: false, action: null, blocked: "diverged" };
      }

      setState((current) => ({ ...current, busyAction: action }));

      try {
        const result = await performSourceControlRemoteAction({
          repo,
          status,
          mode: action,
          fetch: async () => {
            await native.gitFetch(repo.repoRoot);
            touchAutoFetch(autoFetchByRepoRef.current, repo.repoRoot);
          },
          pull: async () => {
            await native.gitFetch(repo.repoRoot);
            touchAutoFetch(autoFetchByRepoRef.current, repo.repoRoot);
            await native.gitPullFfOnly(repo.repoRoot);
          },
          push: async () => {
            await native.gitPush(repo.repoRoot);
          },
          refresh: () => refresh({ remote: "never" }),
        });
        setState((current) => ({
          ...current,
          lastRemoteError: result.ok ? null : result.error ?? null,
        }));
        return result;
      } finally {
        setState((current) => ({ ...current, busyAction: null }));
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++;
      setState({
        repo: null,
        status: null,
        hasRepo: false,
        isLoading: false,
        localError: null,
        busyAction: null,
        lastRemoteError: null,
      });
      return;
    }
    setState((current) => ({ ...current, lastRemoteError: null }));
    const run = () => {
      void refresh({ remote: "never" });
    };
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(run, { timeout: 600 })
        : (window.setTimeout(run, 0) as unknown as number);
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        try {
          window.cancelIdleCallback(idle as number);
        } catch {
          /* noop */
        }
      } else {
        window.clearTimeout(idle as number);
      }
    };
  }, [refresh, contextPath, enabled, workspaceKey]);

  useEffect(() => {
    if (!enabled) return;
    const handleGitRepoChanged = (event: Event) => {
      const changedRepoRoot = gitRepoRootFromChangedEvent(event);
      if (!changedRepoRoot) return;
      const currentRepoRoot = stateRef.current.repo?.repoRoot;
      if (
        currentRepoRoot === changedRepoRoot ||
        pathBelongsToRepo(contextPath, changedRepoRoot)
      ) {
        const pendingRefresh = inflightRef.current;
        if (pendingRefresh) {
          pendingRefresh.finally(() => {
            if (enabledRef.current) {
              void refresh({ remote: "never" });
            }
          });
          return;
        }
        void refresh({ remote: "never" });
      }
    };

    window.addEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);
    return () =>
      window.removeEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);
  }, [contextPath, enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const onFocus = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        const elapsed = Date.now() - lastRefreshAtRef.current;
        if (elapsed < FOCUS_REFRESH_MIN_INTERVAL_MS) return;
        void refresh({ remote: "never" });
      }, 400);
    };

    let unlisten: (() => void) | null = null;
    getCurrentWindow()
      .listen("tauri://focus", onFocus)
      .then((unsub) => {
        unlisten = unsub;
      })
      .catch((err) => {
        console.warn("Failed to listen to tauri://focus:", err);
      });

    return () => {
      if (unlisten) unlisten();
      if (timer) window.clearTimeout(timer);
    };
  }, [refresh, enabled]);

  return useMemo<SourceControlSummary>(
    () => ({
      repo: state.repo,
      status: state.status,
      changedCount: state.status?.changedFiles.length ?? 0,
      upstream: state.status?.upstream ?? state.repo?.upstream ?? null,
      ahead: state.status?.ahead ?? 0,
      behind: state.status?.behind ?? 0,
      hasRepo: state.hasRepo,
      isLoading: state.isLoading,
      localError: state.localError,
      busyAction: state.busyAction,
      lastRemoteError: state.lastRemoteError,
      applyStatus,
      refresh,
      runRemoteAction,
    }),
    [state, applyStatus, refresh, runRemoteAction],
  );
}
