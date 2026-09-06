import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLI_AGENT_DEFINITIONS } from "@/modules/terminal/lib/cliAgents";
import { Task01Icon } from "@hugeicons/core-free-icons";

import { ToolButton } from "./ToolButton";
import type {
  OrchestrationMemoryHit,
  OrchestrationMemoryIndexReport,
  OrchestrationRun,
} from "../lib/orchestrationRuntime";

export type OrchestrationToolbarControls = {
  run: OrchestrationRun | null;
  busy: boolean;
  error: string | null;
  onStartRun: (goal: string) => Promise<void>;
  onSaveDraft: (manifestJson: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onCompleteTask: (taskId: string, result: string) => Promise<void>;
  onRetryTask: (taskId: string) => Promise<void>;
  onReindexMemories: () => Promise<OrchestrationMemoryIndexReport | null>;
  onSearchMemories: (query: string) => Promise<OrchestrationMemoryHit[]>;
};

function providerName(provider: string): string {
  return CLI_AGENT_DEFINITIONS.find((definition) => definition.id === provider)?.name ?? provider;
}

function taskAgentName(run: OrchestrationRun, taskId: string): string {
  const spec = run.manifest.tasks.find((candidate) => candidate.id === taskId);
  return (
    run.manifest.agents.find((agent) => agent.id === spec?.assigneeId)?.name ?? "Unassigned"
  );
}

/**
 * Boss-assigned orchestration controls inside the Canvas toolbar (no chat
 * surface): run bootstrap with an explicit approve gate, plus task
 * completion for workers running in Canvas terminals.
 */
export function OrchestrationToolbarSection({
  controls,
}: {
  controls: OrchestrationToolbarControls | null;
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completeDrafts, setCompleteDrafts] = useState<Record<string, string>>({});
  const [manifestText, setManifestText] = useState<string | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryHits, setMemoryHits] = useState<OrchestrationMemoryHit[]>([]);
  const [memoryReport, setMemoryReport] = useState<string | null>(null);

  if (!controls) return null;
  const { run, busy, error } = controls;
  const runningCount = run?.tasks.filter((task) => task.status === "running").length ?? 0;

  return (
    <span className="relative flex shrink-0 items-center">
      <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
      <ToolButton
        icon={Task01Icon}
        label={run ? `Tasks (${runningCount} running)` : "Orchestrate"}
        onClick={() => {
          setOpen((value) => !value);
          if (run) setManifestText(JSON.stringify(run.manifest, null, 2));
        }}
      />
      {open ? (
        <div className="absolute bottom-14 right-0 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-zinc-300/90 bg-white/95 p-3 text-left text-zinc-800 shadow-[0_10px_28px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:border-zinc-700/90 dark:bg-zinc-900/95 dark:text-zinc-200">
          {!run ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold">Boss assigns tasks to CLI agents</p>
              <Input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Describe the outcome"
                className="text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!goal.trim() || busy}
                onClick={() => void controls.onStartRun(goal.trim())}
              >
                {busy ? "Starting…" : "Start run"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-semibold">{run.manifest.title}</p>
                <span className="shrink-0 text-[10px] text-zinc-500">
                  {run.status.replace(/_/g, " ")}
                </span>
              </div>
              {run.status === "awaiting_approval" ? (
                <div className="space-y-2">
                  <textarea
                    value={manifestText ?? JSON.stringify(run.manifest, null, 2)}
                    onChange={(event) => setManifestText(event.target.value)}
                    className="min-h-32 w-full rounded-md border border-zinc-300 bg-white p-2 font-mono text-[10px] leading-4 dark:border-zinc-700 dark:bg-zinc-950"
                    spellCheck={false}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        manifestText !== null && void controls.onSaveDraft(manifestText)
                      }
                    >
                      Save draft
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void controls.onApprove()}>
                      {busy ? "Starting…" : "Approve & Run"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {run.tasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate font-medium">
                          {run.manifest.tasks.find((candidate) => candidate.id === task.taskId)
                            ?.title ?? task.taskId}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {taskAgentName(run, task.taskId)} · {task.status}
                        </span>
                      </div>
                      {task.status === "running" ? (
                        completingTaskId === task.taskId ? (
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              value={completeDrafts[task.taskId] ?? ""}
                              onChange={(event) =>
                                setCompleteDrafts((drafts) => ({
                                  ...drafts,
                                  [task.taskId]: event.target.value,
                                }))
                              }
                              placeholder="Paste the worker outcome report"
                              className="min-h-16 w-full rounded-md border border-zinc-300 bg-white p-1.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
                              spellCheck={false}
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void controls
                                    .onCompleteTask(task.taskId, completeDrafts[task.taskId] ?? "")
                                    .then(() => setCompletingTaskId(null))
                                }
                              >
                                Mark complete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCompletingTaskId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1"
                            disabled={busy}
                            onClick={() => setCompletingTaskId(task.taskId)}
                          >
                            Complete
                          </Button>
                        )
                      ) : null}
                      {run.status !== "running" &&
                      ["failed", "blocked", "interrupted"].includes(task.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          disabled={busy}
                          onClick={() => void controls.onRetryTask(task.taskId)}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-zinc-500">
                Coordinator: {providerName(run.manifest.orchestrator.provider)}
              </p>
              <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Team memory
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <Input
                    value={memoryQuery}
                    onChange={(event) => setMemoryQuery(event.target.value)}
                    placeholder="Search memories"
                    className="text-[11px]"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && memoryQuery.trim()) {
                        void controls.onSearchMemories(memoryQuery.trim()).then(setMemoryHits);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={busy || !memoryQuery.trim()}
                    onClick={() => void controls.onSearchMemories(memoryQuery.trim()).then(setMemoryHits)}
                  >
                    Search
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    title="Reindex agent memories and board"
                    onClick={() =>
                      void controls.onReindexMemories().then((report) => {
                        if (report) {
                          setMemoryReport(
                            `Indexed ${report.indexed}, skipped ${report.skippedUnchanged}.`,
                          );
                        }
                      })
                    }
                  >
                    Reindex
                  </Button>
                </div>
                {memoryReport ? (
                  <p className="mt-1 text-[10px] text-zinc-500">{memoryReport}</p>
                ) : null}
                <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
                  {memoryHits.map((hit) => (
                    <div
                      key={`${hit.agentId}:${hit.source}:${hit.snippet.slice(0, 24)}`}
                      className="rounded border border-zinc-200 p-1.5 dark:border-zinc-700"
                    >
                      <p className="text-[10px] font-medium">
                        {hit.agentId} · {hit.source}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[10px] text-zinc-500">
                        {hit.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
        </div>
      ) : null}
    </span>
  );
}
