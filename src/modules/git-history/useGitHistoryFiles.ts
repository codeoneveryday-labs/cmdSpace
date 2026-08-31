import { useCallback, useRef, useState } from "react";
import {
  native,
  type GitCommitFileChange,
} from "@/modules/ai/lib/native";

export type GitHistoryFilesEntry =
  | { state: "loading" }
  | { state: "loaded"; files: GitCommitFileChange[] }
  | { state: "error"; error: string };

const FILES_CACHE_LIMIT = 16;

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

export function useGitHistoryFiles(repoRoot: string) {
  const cacheRef = useRef(new Map<string, GitHistoryFilesEntry>());
  const inflightRef = useRef(new Set<string>());
  const [filesTick, setFilesTick] = useState(0);
  const bump = useCallback(() => setFilesTick((value) => value + 1), []);

  const clearCache = useCallback(() => {
    inflightRef.current.clear();
    cacheRef.current.clear();
    bump();
  }, [bump]);

  const fetchFiles = useCallback(async (sha: string) => {
    if (inflightRef.current.has(sha)) return;
    const cache = cacheRef.current;
    const existing = cache.get(sha);
    if (existing && existing.state !== "error") return;
    inflightRef.current.add(sha);
    cache.set(sha, { state: "loading" });
    bump();
    try {
      const files = await native.gitCommitFiles(repoRoot, sha);
      cache.set(sha, { state: "loaded", files });
      while (cache.size > FILES_CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined || oldest === sha) break;
        cache.delete(oldest);
      }
      bump();
    } catch (error) {
      cache.set(sha, { state: "error", error: normalizeError(error) });
      bump();
    } finally {
      inflightRef.current.delete(sha);
    }
  }, [bump, repoRoot]);

  return { cacheRef, filesTick, clearCache, fetchFiles };
}
