import { useMemo, useRef } from "react";
import type { GitLogEntry } from "@/modules/ai/lib/native";
import {
  EMPTY_GRAPH_STATE,
  layoutGraph,
  type GraphRow,
  type GraphState,
} from "./lib/graph";

export type GitHistoryGraphCache = {
  rows: GraphRow[];
  byCommit: Map<string, GraphRow>;
  tail: GraphState;
  firstSha: string | null;
  len: number;
  maxLaneCount: number;
};

export function createGitHistoryGraphCache(): GitHistoryGraphCache {
  return {
    rows: [],
    byCommit: new Map(),
    tail: EMPTY_GRAPH_STATE,
    firstSha: null,
    len: 0,
    maxLaneCount: 1,
  };
}

export function updateGitHistoryGraphCache(
  cache: GitHistoryGraphCache,
  commits: readonly GitLogEntry[],
): { graphByCommit: Map<string, GraphRow>; maxLaneCount: number } {
  if (commits.length === 0) {
    cache.rows = [];
    cache.byCommit = new Map();
    cache.tail = EMPTY_GRAPH_STATE;
    cache.firstSha = null;
    cache.len = 0;
    cache.maxLaneCount = 1;
    return { graphByCommit: cache.byCommit, maxLaneCount: 1 };
  }

  const firstSha = commits[0].sha;
  const canAppend = cache.firstSha === firstSha && commits.length >= cache.len;
  if (!canAppend) {
    const { rows, state } = layoutGraph(commits);
    const byCommit = new Map<string, GraphRow>();
    let max = 1;
    for (const row of rows) {
      byCommit.set(row.sha, row);
      if (row.laneCount > max) max = row.laneCount;
    }
    cache.rows = rows;
    cache.byCommit = byCommit;
    cache.tail = state;
    cache.firstSha = firstSha;
    cache.len = commits.length;
    cache.maxLaneCount = max;
    return { graphByCommit: byCommit, maxLaneCount: max };
  }

  if (commits.length > cache.len) {
    const delta = commits.slice(cache.len);
    const { rows: newRows, state } = layoutGraph(delta, cache.tail);
    let max = cache.maxLaneCount;
    for (const row of newRows) {
      cache.byCommit.set(row.sha, row);
      if (row.laneCount > max) max = row.laneCount;
    }
    cache.rows = cache.rows.concat(newRows);
    cache.tail = state;
    cache.len = commits.length;
    cache.maxLaneCount = max;
  }
  return { graphByCommit: cache.byCommit, maxLaneCount: cache.maxLaneCount };
}

export function useGitHistoryGraph(commits: readonly GitLogEntry[]) {
  const cacheRef = useRef<GitHistoryGraphCache>(createGitHistoryGraphCache());
  return useMemo(
    () => updateGitHistoryGraphCache(cacheRef.current, commits),
    [commits],
  );
}
