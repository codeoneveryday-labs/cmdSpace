import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type { ArchitectureNode } from "./architectureCanvasTypes";
import type { CanvasPurpose } from "@/modules/tabs";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import { createOrchestrationRuntime } from "./orchestrationRuntime";
import { workerPrompt } from "./orchestrationWorkerPrompt";
import {
  buildOrchestrationSpawnNode,
  buildOrchestrationWorkerNode,
  isManualOrchestrationWorker,
  nextOrchestrationWorkerOrigin,
  ORCHESTRATION_PROMPT_MAX_ATTEMPTS,
  ORCHESTRATION_PROMPT_POLL_MS,
  planOrchestrationSpawnNodes,
  planOrchestrationWorkerSpawns,
  tryDeliverWorkerPrompt,
} from "./orchestrationWorkerSpawn";

/**
 * Boss assigns, CLI agents work: when an orchestration run has tasks in
 * `running` state, each one gets a live Canvas terminal node in its prepared
 * worktree running the assignee CLI, then the task brief is typed into the
 * CLI prompt as soon as it accepts input (never auto-submitted).
 * Idempotent — node ids derive from task ids, so reattach and reload never
 * duplicate workers or re-deliver briefs.
 */
export function useCanvasOrchestrationWorkers({
  canvasPurpose,
  orchestrationRunId,
  nodes,
  setNodes,
  terminalHandles,
}: {
  canvasPurpose?: CanvasPurpose;
  orchestrationRunId?: string | null;
  nodes: readonly ArchitectureNode[];
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  terminalHandles?: MutableRefObject<Map<string, CanvasTerminalHandle>>;
}): void {
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const claimedRef = useRef<Set<string>>(new Set());
  const spawnClaimedRef = useRef<Set<string>>(new Set());
  const pendingPromptsRef = useRef<Map<string, { prompt: string; attempts: number }>>(new Map());
  const promptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (canvasPurpose !== "orchestration" || !orchestrationRunId) return;
    const runId = orchestrationRunId;
    let disposed = false;
    const runtime = createOrchestrationRuntime(() => {
      void reconcile();
    });

    const ensurePromptTimer = () => {
      if (promptTimerRef.current !== null) return;
      promptTimerRef.current = setInterval(() => {
        const pending = pendingPromptsRef.current;
        if (pending.size === 0) {
          if (promptTimerRef.current !== null) {
            clearInterval(promptTimerRef.current);
            promptTimerRef.current = null;
          }
          return;
        }
        const liveIds = new Set(nodesRef.current.map((node) => node.id));
        for (const [nodeId, entry] of pending) {
          if (!liveIds.has(nodeId) || entry.attempts >= ORCHESTRATION_PROMPT_MAX_ATTEMPTS) {
            pending.delete(nodeId);
            continue;
          }
          entry.attempts += 1;
          if (
            terminalHandles &&
            tryDeliverWorkerPrompt(terminalHandles.current, nodeId, entry.prompt)
          ) {
            pending.delete(nodeId);
          }
        }
      }, ORCHESTRATION_PROMPT_POLL_MS);
    };

    const reconcile = async () => {
      let snapshot;
      try {
        snapshot = await runtime.snapshot(runId);
      } catch {
        return;
      }
      if (disposed) return;
      const existing = new Set(nodesRef.current.map((node) => node.id));
      const specs = planOrchestrationWorkerSpawns(snapshot, existing).filter(
        (spec) => !claimedRef.current.has(spec.taskId),
      );
      for (const spec of specs) {
        claimedRef.current.add(spec.taskId);
        try {
          const prepared = await runtime.prepareTaskWorktree(runId, spec.taskId);
          if (disposed) return;
          const cwd =
            prepared.tasks.find((task) => task.taskId === spec.taskId)?.worktreePath ??
            prepared.cwd;
          const terminals = nodesRef.current.filter((node) => node.kind === "terminal");
          const node = buildOrchestrationWorkerNode(
            spec,
            cwd,
            nextOrchestrationWorkerOrigin(terminals),
          );
          setNodes((previous) =>
            previous.some((candidate) => candidate.id === node.id)
              ? previous
              : [...previous, node],
          );
          const manifestTask = prepared.manifest.tasks.find(
            (candidate) => candidate.id === spec.taskId,
          );
          if (manifestTask && !pendingPromptsRef.current.has(node.id)) {
            pendingPromptsRef.current.set(node.id, {
              prompt: workerPrompt(prepared, manifestTask, isManualOrchestrationWorker(spec.provider)),
              attempts: 0,
            });
            ensurePromptTimer();
          }
        } catch (error) {
          claimedRef.current.delete(spec.taskId);
          console.warn("orchestration worker spawn failed", error);
        }
      }
      await reconcileSpawnRequests(snapshot);
    };

    const reconcileSpawnRequests = async (snapshot: {
      cwd: string;
      manifest: { orchestrator: { provider: string } };
    }) => {
      let pending;
      try {
        pending = await runtime.listSpawnRequests(runId);
      } catch {
        return;
      }
      if (disposed) return;
      const existing = new Set(nodesRef.current.map((node) => node.id));
      const specs = planOrchestrationSpawnNodes(
        pending,
        existing,
        snapshot.manifest.orchestrator.provider,
      ).filter((spec) => !spawnClaimedRef.current.has(spec.spawnId));
      for (const spec of specs) {
        spawnClaimedRef.current.add(spec.spawnId);
        const terminals = nodesRef.current.filter((node) => node.kind === "terminal");
        const node = buildOrchestrationSpawnNode(
          spec,
          spec.cwd ?? snapshot.cwd,
          nextOrchestrationWorkerOrigin(terminals),
        );
        setNodes((previous) =>
          previous.some((candidate) => candidate.id === node.id)
            ? previous
            : [...previous, node],
        );
        if (!pendingPromptsRef.current.has(node.id)) {
          pendingPromptsRef.current.set(node.id, {
            prompt: `You are a helper in a cmdSpace Canvas orchestration.\n\nObjective: ${spec.objective}`,
            attempts: 0,
          });
          ensurePromptTimer();
        }
        try {
          await runtime.claimSpawnRequest(runId, spec.spawnId);
        } catch (error) {
          console.warn("orchestration spawn claim failed", error);
        }
      }
    };

    void reconcile();
    let attachmentToken: string | null = null;
    runtime
      .attach(runId)
      .then((token) => {
        if (disposed) {
          void runtime.detach(runId, token);
          return;
        }
        attachmentToken = token;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (promptTimerRef.current !== null) {
        clearInterval(promptTimerRef.current);
        promptTimerRef.current = null;
      }
      if (attachmentToken) void runtime.detach(runId, attachmentToken);
    };
  }, [canvasPurpose, orchestrationRunId, setNodes, terminalHandles]);
}
