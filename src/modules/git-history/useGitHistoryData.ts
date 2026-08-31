import { useCallback, useEffect, useRef, useState } from "react";
import {
  native,
  type GitLogEntry,
} from "@/modules/ai/lib/native";
import {
  parseRemoteWebUrl,
  type RemoteWebInfo,
} from "./lib/remoteWebUrl";
import { mergeGitCommits } from "./lib/gitHistoryModel";

const PAGE_SIZE = 30;

type LoadStatus = "idle" | "initial" | "more" | "error";

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

export function useGitHistoryData(repoRoot: string) {
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const [remoteWeb, setRemoteWeb] = useState<RemoteWebInfo | null>(null);
  const requestIdRef = useRef(0);
  const inflightMoreRef = useRef(false);

  const loadInitial = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoadStatus("initial");
    setError(null);
    setEndReached(false);
    try {
      const entries = await native.gitLog(repoRoot, { limit: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      setCommits(entries);
      setLoadStatus("idle");
      if (entries.length < PAGE_SIZE) setEndReached(true);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(normalizeError(loadError));
      setLoadStatus("error");
    }
  }, [repoRoot]);

  const loadMore = useCallback(async () => {
    if (inflightMoreRef.current || endReached || loadStatus !== "idle") return;
    const last = commits[commits.length - 1];
    if (!last) return;
    inflightMoreRef.current = true;
    setLoadStatus("more");
    try {
      const entries = await native.gitLog(repoRoot, {
        limit: PAGE_SIZE,
        beforeSha: last.sha,
      });
      setCommits((previous) => mergeGitCommits(previous, entries));
      if (entries.length < PAGE_SIZE) setEndReached(true);
      setLoadStatus("idle");
    } catch (loadError) {
      setError(normalizeError(loadError));
      setLoadStatus("error");
    } finally {
      inflightMoreRef.current = false;
    }
  }, [commits, endReached, loadStatus, repoRoot]);

  useEffect(() => {
    let cancelled = false;
    native
      .gitRemoteUrl(repoRoot)
      .then((url) => {
        if (!cancelled) setRemoteWeb(parseRemoteWebUrl(url));
      })
      .catch(() => {
        if (!cancelled) setRemoteWeb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repoRoot]);

  return {
    commits,
    loadStatus,
    error,
    endReached,
    remoteWeb,
    loadInitial,
    loadMore,
  };
}
