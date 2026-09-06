import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrchestrationProvider } from "../lib/orchestrationManifest";
import type { OrchestrationManifestV1 } from "../lib/orchestrationManifest";
import {
  createOrchestrationRuntime,
  type OrchestrationRun,
} from "../lib/orchestrationRuntime";
import { applyManifestToOrchestrationDiagram } from "../lib/orchestrationCanvasModel";
import {
  extractOrchestrationProposal,
  parseOrchestrationManifestJson,
} from "../lib/orchestrationProposal";
import { createAgentChatRuntime } from "@/modules/ai/lib/agentChatRuntime";
import { useEffect, useRef, useState } from "react";

export function OrchestrationCanvasPanel({
  workspaceId,
  workspaceCwd,
  orchestratorProvider,
  runId,
  onApplyRun,
}: {
  workspaceId: string | null;
  workspaceCwd: string | null;
  orchestratorProvider?: OrchestrationProvider;
  runId: string | null;
  onApplyRun: (run: OrchestrationRun) => void;
}) {
  const [goal, setGoal] = useState("");
  const provider = orchestratorProvider ?? "codex";
  const [run, setRun] = useState<OrchestrationRun | null>(null);
  const [manifestText, setManifestText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState("orchestrator");
  const runRef = useRef<OrchestrationRun | null>(null);
  runRef.current = run;
  const suppressWorkerCompletionRef = useRef(false);
  const freshWorkerTasksRef = useRef(new Set<string>());
  const onApplyRunRef = useRef(onApplyRun);
  onApplyRunRef.current = onApplyRun;
  const attachmentRef = useRef<{ runId: string; token: string } | null>(null);
  const proposalSessionRef = useRef<string | null>(null);
  const proposalTextRef = useRef("");
  const proposalCompletionRef = useRef<{
    resolve: (manifest: OrchestrationManifestV1) => void;
    reject: (reason: Error) => void;
  } | null>(null);
  const workerRuntimesRef = useRef(
    new Map<string, { runtime: ReturnType<typeof createAgentChatRuntime>; sessionId: string | null }>(),
  );
  const runtimeRef = useRef<ReturnType<typeof createOrchestrationRuntime> | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createOrchestrationRuntime(() => undefined);
  }
  const proposalRuntimeRef = useRef<ReturnType<typeof createAgentChatRuntime> | null>(null);
  if (proposalRuntimeRef.current === null) {
    proposalRuntimeRef.current = createAgentChatRuntime((event) => {
      if (event.type === "assistant") proposalTextRef.current += event.text;
      if (event.type === "error") {
        proposalCompletionRef.current?.reject(new Error(event.message));
        proposalCompletionRef.current = null;
      }
      if (event.type === "done" && proposalCompletionRef.current) {
        try {
          proposalCompletionRef.current.resolve(
            extractOrchestrationProposal(proposalTextRef.current),
          );
        } catch (cause) {
          proposalCompletionRef.current.reject(
            cause instanceof Error ? cause : new Error(String(cause)),
          );
        }
        proposalCompletionRef.current = null;
      }
    });
  }

  useEffect(() => {
    if (!runId) return;
    let disposed = false;
    void runtimeRef.current!
      .snapshot(runId)
      .then((snapshot) => {
        if (disposed) return;
        setRun(snapshot);
        setManifestText(JSON.stringify(snapshot.manifest, null, 2));
        onApplyRunRef.current(snapshot);
        return runtimeRef.current!.attach(runId).then((token) => {
          if (disposed) {
            void runtimeRef.current!.detach(runId, token);
            return;
          }
          attachmentRef.current = { runId, token };
          void startReadyTasks(snapshot);
        });
      })
      .catch((cause) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      disposed = true;
      const attachment = attachmentRef.current;
      if (attachment?.runId === runId) {
        attachmentRef.current = null;
        void runtimeRef.current?.detach(attachment.runId, attachment.token);
      }
    };
  }, [runId]);

  const createDraft = async () => {
    if (!workspaceId || !workspaceCwd || !goal.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      proposalTextRef.current = "";
      const completion = new Promise<OrchestrationManifestV1>((resolve, reject) => {
        proposalCompletionRef.current = { resolve, reject };
      });
      const runId = `orchestration-${Date.now().toString(36)}`;
      if (proposalSessionRef.current) {
        await proposalRuntimeRef.current!.send(
          proposalSessionRef.current,
          proposalPrompt(goal, provider),
        );
      } else {
        const proposalSession = await proposalRuntimeRef.current!.start({
          provider,
          cwd: workspaceCwd,
          prompt: proposalPrompt(goal, provider),
          chatId: `orchestration:${runId}:orchestrator`,
          nativeSessionId: null,
        });
        proposalSessionRef.current = proposalSession.sessionId;
      }
      const manifest = await completion;
      const created = await runtimeRef.current!.createRun(workspaceId, workspaceCwd, runId, manifest);
      setRun(created);
      setManifestText(JSON.stringify(created.manifest, null, 2));
      onApplyRunRef.current(created);
      attachmentRef.current = {
        runId: created.id,
        token: await runtimeRef.current!.attach(created.id),
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      const approved = await runtimeRef.current!.approveAndStart(run.id, run.revision);
      setRun(approved);
      onApplyRunRef.current(approved);
      await startReadyTasks(approved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const updateRun = (snapshot: OrchestrationRun) => {
    setRun(snapshot);
    onApplyRunRef.current(snapshot);
  };

  const cancelActiveWorkers = async () => {
    suppressWorkerCompletionRef.current = true;
    for (const taskId of workerRuntimesRef.current.keys()) {
      freshWorkerTasksRef.current.add(taskId);
    }
    await Promise.all(
      [...workerRuntimesRef.current.values()]
        .filter((worker) => worker.sessionId)
        .map((worker) => worker.runtime.cancel(worker.sessionId!).catch(() => undefined)),
    );
    workerRuntimesRef.current.clear();
  };

  const pauseRun = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelActiveWorkers();
      updateRun(await runtimeRef.current!.pause(run.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const resumeRun = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      suppressWorkerCompletionRef.current = false;
      const resumed = await runtimeRef.current!.resume(run.id);
      updateRun(resumed);
      await startReadyTasks(resumed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const cancelRun = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelActiveWorkers();
      updateRun(await runtimeRef.current!.cancel(run.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const retryTask = async (taskId: string) => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      suppressWorkerCompletionRef.current = false;
      const retried = await runtimeRef.current!.retryTask(run.id, taskId);
      updateRun(retried);
      await startReadyTasks(retried);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const startReadyTasks = async (snapshot: OrchestrationRun) => {
    for (const execution of snapshot.tasks) {
      if (execution.status !== "running" || workerRuntimesRef.current.has(execution.taskId)) {
        continue;
      }
      const task = snapshot.manifest.tasks.find((candidate) => candidate.id === execution.taskId);
      const agent = snapshot.manifest.agents.find((candidate) => candidate.id === task?.assigneeId);
      if (!task || !agent) continue;
      try {
        if (execution.chatId && !freshWorkerTasksRef.current.has(task.id)) {
          const reattached = createWorkerRuntime(snapshot, task);
          try {
            const attached = await reattached.runtime.attach(execution.chatId);
            workerRuntimesRef.current.set(task.id, {
              runtime: reattached.runtime,
              sessionId: attached.sessionId,
            });
            continue;
          } catch {
            // The persisted provider session may no longer be attachable; start a new attempt.
          }
        }
        const prepared = await runtimeRef.current!.prepareTaskWorktree(snapshot.id, task.id);
        setRun(prepared);
        onApplyRunRef.current(prepared);
        const worker = createWorkerRuntime(snapshot, task);
        const workerRuntime = worker.runtime;
        workerRuntimesRef.current.set(task.id, { runtime: workerRuntime, sessionId: null });
        const started = await workerRuntime.start({
          provider: agent.provider,
          cwd: prepared.tasks.find((candidate) => candidate.taskId === task.id)?.worktreePath ?? snapshot.cwd,
          prompt: workerPrompt(snapshot, task),
          chatId: `orchestration:${snapshot.id}:${task.id}`,
          nativeSessionId: null,
          model: agent.model,
        });
        const bound = await runtimeRef.current!.bindTaskSession(
          snapshot.id,
          task.id,
          `orchestration:${snapshot.id}:${task.id}`,
          started.sessionId,
        );
        setRun(bound);
        onApplyRunRef.current(bound);
        freshWorkerTasksRef.current.delete(task.id);
        workerRuntimesRef.current.set(task.id, { runtime: workerRuntime, sessionId: started.sessionId });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        await runtimeRef.current!
          .failTask(snapshot.id, task.id, cause instanceof Error ? cause.message : String(cause))
          .then(updateRun)
          .catch(() => undefined);
      }
    }
  };

  const createWorkerRuntime = (
    snapshot: OrchestrationRun,
    task: OrchestrationManifestV1["tasks"][number],
  ) => {
    const output = { text: "", completed: false, failed: false };
    const runtime = createAgentChatRuntime((event) => {
      if (event.type === "assistant") output.text += event.text;
      if (event.type === "error" && !output.failed && !suppressWorkerCompletionRef.current) {
        output.failed = true;
        setError(event.message);
        void runtimeRef.current!
          .failTask(snapshot.id, task.id, event.message)
          .then(updateRun)
          .catch(() => undefined);
      }
      if (
        event.type === "done" &&
        !output.completed &&
        !output.failed &&
        !suppressWorkerCompletionRef.current &&
        runRef.current?.status === "running"
      ) {
        output.completed = true;
        void runtimeRef.current!
          .completeTask(snapshot.id, task.id, output.text.trim() || "Worker completed the task.")
          .then((updated) => {
            updateRun(updated);
            workerRuntimesRef.current.delete(task.id);
            void startReadyTasks(updated);
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
      }
    });
    return { runtime, output };
  };

  const saveDraftRevision = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      const manifest = parseOrchestrationManifestJson(manifestText);
      const updated = await runtimeRef.current!.updateDraft(
        run.id,
        run.revision,
        manifest,
      );
      setRun(updated);
      setManifestText(JSON.stringify(updated.manifest, null, 2));
      onApplyRunRef.current(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="absolute right-4 top-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Agent orchestration</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Canvas-only task control</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-violet-400/50 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-violet-700 dark:text-violet-200">
            ORCHESTRATOR
          </span>
          {run ? <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{run.status.replace(/_/g, " ")}</span> : null}
        </div>
      </div>

      {run ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{run.manifest.goal}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>{run.manifest.agents.length} agent{run.manifest.agents.length === 1 ? "" : "s"}</span>
            <span>{run.tasks.length} task{run.tasks.length === 1 ? "" : "s"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Coordinator: <span className="font-medium text-foreground">{providerLabel(run.manifest.orchestrator.provider)}</span>
            {run.manifest.orchestrator.model ? ` · ${run.manifest.orchestrator.model}` : ""}
          </p>
          <section aria-labelledby="orchestration-team-roster" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="orchestration-team-roster" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Team roster
              </h3>
              <span className="text-[10px] text-muted-foreground">Boss + workers</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={selectedTeamMember === "orchestrator"}
                onClick={() => setSelectedTeamMember("orchestrator")}
                className={cn(
                  "min-h-16 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
                  selectedTeamMember === "orchestrator"
                    ? "border-violet-400/70 bg-violet-500/[0.12]"
                    : "border-border/60 bg-card/30 hover:border-violet-400/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded border border-violet-400/50 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-violet-700 dark:text-violet-200">BOSS</span>
                  <span className="text-[10px] font-semibold text-foreground">ORCHESTRATOR</span>
                </div>
                <p className="mt-2 truncate text-[11px] text-muted-foreground">
                  {providerLabel(run.manifest.orchestrator.provider)}{run.manifest.orchestrator.model ? ` · ${run.manifest.orchestrator.model}` : ""}
                </p>
              </button>
              {run.manifest.agents.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  aria-pressed={selectedTeamMember === agent.id}
                  onClick={() => setSelectedTeamMember(agent.id)}
                  className={cn(
                    "min-h-16 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
                    selectedTeamMember === agent.id
                      ? "border-sky-400/70 bg-sky-500/[0.12]"
                      : "border-border/60 bg-card/30 hover:border-sky-400/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded border border-sky-400/50 bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-sky-700 dark:text-sky-200">WORKER</span>
                    <span className="truncate text-[11px] font-semibold text-foreground">{agent.name}</span>
                  </div>
                  <p className="mt-2 truncate text-[11px] text-muted-foreground">
                    {providerLabel(agent.provider)} · {agent.role}
                  </p>
                </button>
              ))}
            </div>
            {selectedTeamMember === "orchestrator" ? (
              <div className="rounded-md border border-violet-400/30 bg-violet-500/[0.06] p-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Boss</span> proposes the graph, assigns work, and receives worker reports.
              </div>
            ) : (() => {
              const selectedAgent = run.manifest.agents.find((agent) => agent.id === selectedTeamMember);
              if (!selectedAgent) return null;
              const assignedTasks = run.tasks.filter((task) =>
                run.manifest.tasks.some((spec) => spec.id === task.taskId && spec.assigneeId === selectedAgent.id),
              );
              return (
                <div className="rounded-md border border-sky-400/30 bg-sky-500/[0.06] p-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{selectedAgent.name}</span>
                    <span>{providerLabel(selectedAgent.provider)}</span>
                  </div>
                  <p className="mt-1">{selectedAgent.role}</p>
                  <p className="mt-1">Assigned: {assignedTasks.length ? assignedTasks.map((task) => `${task.taskId} (${task.status})`).join(", ") : "No tasks"}</p>
                </div>
              );
            })()}
          </section>
          {run.status === "awaiting_approval" ? (
            <>
              <label className="block text-xs font-medium text-foreground" htmlFor="orchestration-manifest">Draft manifest</label>
              <textarea
                id="orchestration-manifest"
                value={manifestText}
                onChange={(event) => setManifestText(event.target.value)}
                className="min-h-44 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-4"
                spellCheck={false}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => void saveDraftRevision()}>
                  {busy ? "Saving…" : "Save draft revision"}
                </Button>
                <Button disabled={busy} onClick={() => void approve()}>
                  {busy ? "Starting…" : "Approve & Run"}
                </Button>
              </div>
            </>
          ) : null}
          <div className="space-y-1.5 rounded-md border border-border/60 p-2 text-[11px]">
            {run.tasks.map((task) => (
              <div className="flex items-center justify-between gap-2" key={task.taskId}>
                <span className="min-w-0 truncate text-muted-foreground">
                  {run.manifest.tasks.find((candidate) => candidate.id === task.taskId)?.title ?? task.taskId}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {run.manifest.agents.find((agent) => agent.id === run.manifest.tasks.find((candidate) => candidate.id === task.taskId)?.assigneeId)?.name ?? "Unassigned"}
                </span>
                <span className="shrink-0 font-medium text-foreground">{task.status}</span>
                {run.status !== "running" && ["failed", "blocked", "interrupted"].includes(task.status) ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void retryTask(task.taskId)}>
                    Retry
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {run.status === "running" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void pauseRun()}>
                Pause
              </Button>
            ) : null}
            {run.status === "paused" || run.status === "interrupted" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void resumeRun()}>
                Resume run
              </Button>
            ) : null}
            {run.status === "running" || run.status === "paused" || run.status === "interrupted" ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancelRun()}>
                Cancel
              </Button>
            ) : null}
          </div>
          {run.status === "review_required" ? (
            <p className="text-xs text-muted-foreground">
              Review required on {run.integrationBranch ?? "the internal integration branch"}; the current working branch was not changed.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-foreground" htmlFor="orchestration-goal">Goal</label>
          <Input
            id="orchestration-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Describe the outcome"
          />
          <Button className="w-full" disabled={!workspaceId || !workspaceCwd || !goal.trim() || busy} onClick={() => void createDraft()}>
            {busy ? "Asking boss…" : "Ask boss for draft"}
          </Button>
        </div>
      )}

      <p aria-live="polite" className="mt-3 text-xs text-destructive">
        {error ?? ""}
      </p>
    </aside>
  );
}

function proposalPrompt(goal: string, provider: OrchestrationProvider): string {
  return `You are the Canvas Orchestrator CLI agent. Propose a small, dependency-valid coding-agent graph for this goal. Return exactly one JSON object inside <cmdspace-orchestration> and </cmdspace-orchestration>, with no Markdown, comments, JSON Schema, or wrapper object. The top-level object must have version: 1, title: a string, goal: a string, orchestrator: { provider: "${provider}" }, agents: an array, and tasks: an array. Every task must have id, title, instructions, assigneeId, dependsOn, writeAccess, doneWhen, and validationCommands. Use only codex, claude, or cmd providers. Do not start work or call tools. Goal: ${goal.trim()}`;
}

function workerPrompt(
  run: OrchestrationRun,
  task: OrchestrationManifestV1["tasks"][number],
): string {
  const dependencies = task.dependsOn
    .map((dependency) => run.tasks.find((candidate) => candidate.taskId === dependency)?.result)
    .filter((result): result is string => Boolean(result));
  return [
    "You are a worker in an approved cmdSpace Canvas orchestration.",
    `Overall goal: ${run.manifest.goal}`,
    `Task: ${task.title}`,
    `Instructions: ${task.instructions}`,
    `Done when: ${task.doneWhen}`,
    dependencies.length > 0 ? `Dependency reports:\n${dependencies.join("\n\n")}` : "",
    "Report a concise outcome when the task is complete.",
  ].filter(Boolean).join("\n\n");
}

function providerLabel(provider: OrchestrationProvider): string {
  return provider === "cmd" ? "Command Code" : provider === "codex" ? "Codex" : "Claude Code";
}

export function applyOrchestrationRunToCanvas(
  diagram: Parameters<typeof applyManifestToOrchestrationDiagram>[0],
  run: OrchestrationRun,
) {
  return applyManifestToOrchestrationDiagram(diagram, run.manifest, run.id);
}
