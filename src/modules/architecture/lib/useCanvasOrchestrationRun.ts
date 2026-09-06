import { useEffect, useRef, useState } from "react";

import type { CanvasPurpose, OrchestrationProvider } from "@/modules/tabs";
import { createOrchestrationDraft } from "./orchestrationManifest";
import { parseOrchestrationManifestJson } from "./orchestrationProposal";
import {
  createOrchestrationRuntime,
  type OrchestrationMemoryHit,
  type OrchestrationMemoryIndexReport,
  type OrchestrationRun,
} from "./orchestrationRuntime";
import {
  ORCHESTRATION_MAIL_MAX_FLIGHTS,
  parseMailSentRoute,
  type OrchestrationMailRoute,
} from "./orchestrationMailFlights";

export type OrchestrationMailFlightSeed = OrchestrationMailRoute & {
  key: string;
};

/**
 * Run lifecycle for Boss-assigned orchestration, without a side panel: the
 * Canvas attaches to the run (snapshot + live events) and exposes the
 * worker-facing transitions the toolbar needs (start, save draft, approve,
 * complete, retry). Spawning stays in `useCanvasOrchestrationWorkers`.
 */
export function useCanvasOrchestrationRun({
  canvasPurpose,
  orchestrationRunId,
  workspaceId,
  workspaceCwd,
  orchestrationProvider,
  onRunIdChange,
}: {
  canvasPurpose?: CanvasPurpose;
  orchestrationRunId?: string | null;
  workspaceId?: string | null;
  workspaceCwd?: string | null;
  orchestrationProvider?: OrchestrationProvider;
  onRunIdChange?: (runId: string | null) => void;
}): {
  run: OrchestrationRun | null;
  busy: boolean;
  error: string | null;
  startRun: (goal: string) => Promise<void>;
  saveDraft: (manifestJson: string) => Promise<void>;
  approveRun: () => Promise<void>;
  completeTask: (taskId: string, result: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  reindexMemories: () => Promise<OrchestrationMemoryIndexReport | null>;
  searchMemories: (query: string) => Promise<OrchestrationMemoryHit[]>;
  mailFlights: OrchestrationMailFlightSeed[];
  dismissMailFlight: (key: string) => void;
} {
  const [run, setRun] = useState<OrchestrationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailFlights, setMailFlights] = useState<OrchestrationMailFlightSeed[]>([]);
  const flightCounterRef = useRef(0);
  const runtimeRef = useRef<ReturnType<typeof createOrchestrationRuntime> | null>(null);
  const runIdRef = useRef<string | null>(null);
  // Lazily created inside effects and event handlers only: constructing the
  // runtime opens a Tauri Channel, which requires a browser window.
  const getRuntime = () => {
    if (runtimeRef.current === null) {
      runtimeRef.current = createOrchestrationRuntime((event) => {
        const route = parseMailSentRoute(event);
        if (route) {
          flightCounterRef.current += 1;
          const key = `${route.from}→${route.to}:${flightCounterRef.current}`;
          setMailFlights((previous) =>
            previous.length >= ORCHESTRATION_MAIL_MAX_FLIGHTS
              ? previous
              : [...previous, { ...route, key }],
          );
        }
        const id = runIdRef.current;
        if (id) {
          void runtimeRef
            .current!.snapshot(id)
            .then((snapshot) => {
              if (runIdRef.current === id) setRun(snapshot);
            })
            .catch(() => undefined);
        }
      });
    }
    return runtimeRef.current;
  };

  useEffect(() => {
    runIdRef.current = orchestrationRunId ?? null;
    if (canvasPurpose !== "orchestration" || !orchestrationRunId) {
      setRun(null);
      return;
    }
    const runId = orchestrationRunId;
    const runtime = getRuntime();
    let disposed = false;
    void runtime
      .snapshot(runId)
      .then((snapshot) => {
        if (!disposed) setRun(snapshot);
      })
      .catch((cause) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : String(cause));
      });
    let attachmentToken: string | null = null;
    void runtime
      .attach(runId)
      .then((token) => {
        if (disposed) {
          void getRuntime().detach(runId, token);
          return;
        }
        attachmentToken = token;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (attachmentToken) void getRuntime().detach(runId, attachmentToken);
    };
  }, [canvasPurpose, orchestrationRunId]);

  const fail = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  };

  const dismissMailFlight = (key: string) => {
    setMailFlights((previous) => previous.filter((flight) => flight.key !== key));
  };
  const startRun = async (goal: string) => {
    if (!workspaceId || !workspaceCwd || !goal.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const runId = `orchestration-${Date.now().toString(36)}`;
      const created = await getRuntime().createRun(
        workspaceId,
        workspaceCwd,
        runId,
        createOrchestrationDraft(goal.trim(), orchestrationProvider ?? "codex"),
      );
      setRun(created);
      onRunIdChange?.(created.id);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async (manifestJson: string) => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      const manifest = parseOrchestrationManifestJson(manifestJson);
      setRun(await getRuntime().updateDraft(run.id, run.revision, manifest));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const approveRun = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      setRun(await getRuntime().approveAndStart(run.id, run.revision));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async (taskId: string, result: string) => {
    if (!run || busy || !result.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setRun(await getRuntime().completeTask(run.id, taskId, result.trim()));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const retryTask = async (taskId: string) => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      setRun(await getRuntime().retryTask(run.id, taskId));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const reindexMemories = async () => {
    if (!run || busy) return null;
    setBusy(true);
    setError(null);
    try {
      return await getRuntime().reindexMemories(run.id);
    } catch (cause) {
      fail(cause);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const searchMemories = async (query: string) => {
    if (!run || busy || !query.trim()) return [];
    setBusy(true);
    setError(null);
    try {
      return await getRuntime().searchMemories(run.id, query.trim());
    } catch (cause) {
      fail(cause);
      return [];
    } finally {
      setBusy(false);
    }
  };

  return {
    run,
    busy,
    error,
    startRun,
    saveDraft,
    approveRun,
    completeTask,
    retryTask,
    reindexMemories,
    searchMemories,
    mailFlights,
    dismissMailFlight,
  };
}
