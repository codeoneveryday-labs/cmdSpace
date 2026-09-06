import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrchestrationProvider } from "../lib/orchestrationManifest";
import type { OrchestrationManifestV1 } from "../lib/orchestrationManifest";
import {
  createOrchestrationRuntime,
  ORCHESTRATION_MAIL_BROADCAST,
  ORCHESTRATION_MAIL_ORCHESTRATOR_ID,
  type OrchestrationHiveAct,
  type OrchestrationHiveMessage,
  type OrchestrationRun,
} from "../lib/orchestrationRuntime";
import { applyManifestToOrchestrationDiagram } from "../lib/orchestrationCanvasModel";
import {
  extractOrchestrationProposal,
  parseOrchestrationManifestJson,
} from "../lib/orchestrationProposal";
import { createAgentChatRuntime } from "@/modules/ai/lib/agentChatRuntime";
import {
  CLI_AGENT_DEFINITIONS,
  ORCHESTRATION_FALLBACK_PROVIDERS,
} from "@/modules/terminal/lib/cliAgents";
import { useEffect, useRef, useState } from "react";

const ORCHESTRATION_PROVIDER_IDS = CLI_AGENT_DEFINITIONS.map((agent) => agent.id).join(", ");

function isStructuredOrchestrationProvider(provider: OrchestrationProvider): boolean {
  return !ORCHESTRATION_FALLBACK_PROVIDERS.has(provider);
}

function providerLabel(provider: OrchestrationProvider): string {
  return CLI_AGENT_DEFINITIONS.find((agent) => agent.id === provider)?.name ?? provider;
}

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
  const [manualWorkers, setManualWorkers] = useState<
    Record<string, { launch: string; cwd: string; prompt: string; agentName: string }>
  >({});
  const manualWorkersRef = useRef<Record<string, { launch: string; cwd: string; prompt: string; agentName: string }>>({});
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completeDrafts, setCompleteDrafts] = useState<Record<string, string>>({});
  const [mailIdentity, setMailIdentity] = useState<string>(ORCHESTRATION_MAIL_ORCHESTRATOR_ID);
  const [mailInbox, setMailInbox] = useState<OrchestrationHiveMessage[]>([]);
  const [mailTo, setMailTo] = useState<string>(ORCHESTRATION_MAIL_BROADCAST);
  const [mailAct, setMailAct] = useState<OrchestrationHiveAct>("request");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailReport, setMailReport] = useState<string | null>(null);
  const [mailReplyTo, setMailReplyTo] = useState<OrchestrationHiveMessage | null>(null);
  const [mailUnreadTotal, setMailUnreadTotal] = useState<number | null>(null);
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

  const completeManualTask = async (taskId: string) => {
    if (!run || busy) return;
    const result = (completeDrafts[taskId] ?? "").trim();
    if (!result) {
      setError("Paste the worker outcome report before completing the task.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await runtimeRef.current!.completeTask(run.id, taskId, result);
      delete manualWorkersRef.current[taskId];
      setManualWorkers({ ...manualWorkersRef.current });
      setCompleteDrafts((drafts) => {
        const next = { ...drafts };
        delete next[taskId];
        return next;
      });
      setCompletingTaskId(null);
      updateRun(updated);
      await startReadyTasks(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const refreshInbox = async (runId: string, agentId: string) => {
    try {
      setMailInbox(await runtimeRef.current!.loadInbox(runId, agentId));
      setMailUnreadTotal((await runtimeRef.current!.loadUnread(runId, agentId)).total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const startReply = (message: OrchestrationHiveMessage) => {
    if (message.from !== mailIdentity) setMailTo(message.from);
    setMailSubject((subject) =>
      subject.trim() ? subject : `Re: ${message.subject}`,
    );
    setMailReplyTo(message);
  };

  const sendMail = async () => {
    if (!run || busy) return;
    if (!mailSubject.trim() || !mailBody.trim()) {
      setError("Mail needs a subject and a body.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await runtimeRef.current!.sendMail({
        runId: run.id,
        from: mailIdentity,
        to: mailTo,
        act: mailAct,
        subject: mailSubject.trim(),
        body: mailBody.trim(),
        conversation: mailReplyTo?.conversation ?? null,
        inReplyTo: mailReplyTo?.id ?? null,
      });
      const report = await runtimeRef.current!.routeMail(run.id);
      setMailReport(
        `Delivered ${report.delivered.length}, skipped ${report.skipped.length}.`,
      );
      setMailSubject("");
      setMailBody("");
      setMailReplyTo(null);
      await refreshInbox(run.id, mailIdentity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const ackMail = async (messageId: string) => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      setMailInbox(await runtimeRef.current!.ackMail(run.id, mailIdentity, messageId));
      setMailUnreadTotal((await runtimeRef.current!.loadUnread(run.id, mailIdentity)).total);
      if (mailReplyTo?.id === messageId) setMailReplyTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const routeOutbox = async () => {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      const report = await runtimeRef.current!.routeMail(run.id);
      setMailReport(
        `Delivered ${report.delivered.length}, skipped ${report.skipped.length}.`,
      );
      await refreshInbox(run.id, mailIdentity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const startReadyTasks = async (snapshot: OrchestrationRun) => {
    for (const execution of snapshot.tasks) {
      if (
        execution.status !== "running" ||
        workerRuntimesRef.current.has(execution.taskId) ||
        manualWorkersRef.current[execution.taskId]
      ) {
        continue;
      }
      const task = snapshot.manifest.tasks.find((candidate) => candidate.id === execution.taskId);
      const agent = snapshot.manifest.agents.find((candidate) => candidate.id === task?.assigneeId);
      if (!task || !agent) continue;
      // CLIs without a structured chat transport run as manual terminal
      // workers: plain PTY + human completion (munder-difflin style).
      if (!isStructuredOrchestrationProvider(agent.provider)) {
        try {
          const prepared = await runtimeRef.current!.prepareTaskWorktree(snapshot.id, task.id);
          setRun(prepared);
          onApplyRunRef.current(prepared);
          const cwd =
            prepared.tasks.find((candidate) => candidate.taskId === task.id)?.worktreePath ??
            snapshot.cwd;
          const entry = {
            launch:
              CLI_AGENT_DEFINITIONS.find((definition) => definition.id === agent.provider)
                ?.launch ?? agent.provider,
            cwd,
            prompt: workerPrompt(snapshot, task, true),
            agentName: agent.name,
          };
          manualWorkersRef.current[task.id] = entry;
          setManualWorkers({ ...manualWorkersRef.current });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          await runtimeRef.current!
            .failTask(snapshot.id, task.id, cause instanceof Error ? cause.message : String(cause))
            .then(updateRun)
            .catch(() => undefined);
        }
        continue;
      }
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
              const manualEntries = assignedTasks
                .map((task) => ({ task, manual: manualWorkers[task.taskId] }))
                .filter((entry) => entry.manual);
              return (
                <div className="rounded-md border border-sky-400/30 bg-sky-500/[0.06] p-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{selectedAgent.name}</span>
                    <span>{providerLabel(selectedAgent.provider)}</span>
                  </div>
                  <p className="mt-1">{selectedAgent.role}</p>
                  <p className="mt-1">Assigned: {assignedTasks.length ? assignedTasks.map((task) => `${task.taskId} (${task.status})`).join(", ") : "No tasks"}</p>
                  {isStructuredOrchestrationProvider(selectedAgent.provider) ? null : (
                    <p className="mt-1 text-amber-600 dark:text-amber-300">
                      Manual terminal worker: no structured session. Run the launch command below in any Canvas terminal.
                    </p>
                  )}
                  {manualEntries.map(({ task, manual }) => (
                    <div key={task.taskId} className="mt-2 space-y-1 rounded border border-border/60 bg-background/60 p-2">
                      <p className="font-mono text-[10px] text-foreground">cd {manual!.cwd}</p>
                      <p className="font-mono text-[10px] text-foreground">{manual!.launch}</p>
                      <p className="whitespace-pre-wrap text-[10px]">{manual!.prompt}</p>
                    </div>
                  ))}
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
              <div key={task.taskId}>
                <div className="flex items-center justify-between gap-2">
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
                  {task.status === "running" && manualWorkers[task.taskId] ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setCompletingTaskId(completingTaskId === task.taskId ? null : task.taskId)}
                    >
                      Complete
                    </Button>
                  ) : null}
                </div>
                {completingTaskId === task.taskId && manualWorkers[task.taskId] ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea
                      value={completeDrafts[task.taskId] ?? ""}
                      onChange={(event) =>
                        setCompleteDrafts((drafts) => ({ ...drafts, [task.taskId]: event.target.value }))
                      }
                      placeholder="Paste the worker outcome report"
                      className="min-h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-4"
                      spellCheck={false}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void completeManualTask(task.taskId)}>
                        {busy ? "Completing…" : "Mark complete"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCompletingTaskId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <section aria-labelledby="orchestration-mailbox" className="space-y-2 rounded-md border border-border/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="orchestration-mailbox" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mailbox{mailUnreadTotal ? ` (${mailUnreadTotal})` : ""}
              </h3>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (!run) return;
                    void refreshInbox(run.id, mailIdentity);
                  }}
                >
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void routeOutbox()}>
                  Route outbox
                </Button>
              </div>
            </div>
            <label className="block text-[11px] text-muted-foreground" htmlFor="orchestration-mail-identity">
              Reading as
              <select
                id="orchestration-mail-identity"
                value={mailIdentity}
                onChange={(event) => {
                  setMailIdentity(event.target.value);
                  setMailReplyTo(null);
                  if (run) void refreshInbox(run.id, event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-[11px]"
              >
                {[ORCHESTRATION_MAIL_ORCHESTRATOR_ID, ...run.manifest.agents.map((agent) => agent.id)].map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
            <div className="space-y-1.5">
              {mailInbox.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Inbox empty.</p>
              ) : (
                mailInbox.map((message) => (
                  <div key={message.id} className="rounded border border-border/60 bg-background/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                        [{message.act}] {message.subject}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => startReply(message)}>
                          Reply
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void ackMail(message.id)}>
                          Ack
                        </Button>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {message.from} → {message.to} · hops {message.hops}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{message.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block text-[11px] text-muted-foreground">
                To
                <select
                  value={mailTo}
                  onChange={(event) => setMailTo(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-[11px]"
                >
                  {[ORCHESTRATION_MAIL_BROADCAST, ORCHESTRATION_MAIL_ORCHESTRATOR_ID, ...run.manifest.agents.map((agent) => agent.id)]
                    .filter((id, index, all) => all.indexOf(id) === index && id !== mailIdentity)
                    .map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                </select>
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Act
                <select
                  value={mailAct}
                  onChange={(event) => setMailAct(event.target.value as OrchestrationHiveAct)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-[11px]"
                >
                  {(["request", "inform", "propose", "query", "agree", "refuse", "done"] as const).map((act) => (
                    <option key={act} value={act}>{act}{["request", "query", "propose"].includes(act) ? " (reply expected)" : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            {mailReplyTo ? (
              <p className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="min-w-0 truncate">
                  Replying to [{mailReplyTo.act}] {mailReplyTo.subject} (hops {mailReplyTo.hops} → {mailReplyTo.hops + 1})
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setMailReplyTo(null)}>
                  Cancel
                </Button>
              </p>
            ) : null}
            <Input
              value={mailSubject}
              onChange={(event) => setMailSubject(event.target.value)}
              placeholder="Subject"
              className="text-[11px]"
            />
            <textarea
              value={mailBody}
              onChange={(event) => setMailBody(event.target.value)}
              placeholder="Message body"
              className="min-h-16 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-4"
              spellCheck={false}
            />
            <Button size="sm" className="w-full" disabled={busy} onClick={() => void sendMail()}>
              {busy ? "Sending…" : `Send as ${mailIdentity}`}
            </Button>
            {mailReport ? (
              <p className="text-[11px] text-muted-foreground">{mailReport}</p>
            ) : null}
          </section>
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
  return `You are the Canvas Orchestrator CLI agent. Propose a small, dependency-valid coding-agent graph for this goal. Return exactly one JSON object inside <cmdspace-orchestration> and </cmdspace-orchestration>, with no Markdown, comments, JSON Schema, or wrapper object. The top-level object must have version: 1, title: a string, goal: a string, orchestrator: { provider: "${provider}" }, agents: an array, and tasks: an array. Every task must have id, title, instructions, assigneeId, dependsOn, writeAccess, doneWhen, and validationCommands. For agent providers use only: ${ORCHESTRATION_PROVIDER_IDS}. Prefer providers with structured sessions (codex, claude, cmd, gemini, opencode, omp); other CLIs run as manual terminal workers. Do not start work or call tools. Goal: ${goal.trim()}`;
}

import { workerPrompt } from "../lib/orchestrationWorkerPrompt";

export function applyOrchestrationRunToCanvas(
  diagram: Parameters<typeof applyManifestToOrchestrationDiagram>[0],
  run: OrchestrationRun,
) {
  return applyManifestToOrchestrationDiagram(diagram, run.manifest, run.id);
}
