import type { OrchestrationManifestV1 } from "./orchestrationManifest";
import type { OrchestrationRun } from "./orchestrationRuntime";

export function workerPrompt(
  run: OrchestrationRun,
  task: OrchestrationManifestV1["tasks"][number],
  manual = false,
): string {
  const dependencies = task.dependsOn
    .map((dependency) => run.tasks.find((candidate) => candidate.taskId === dependency)?.result)
    .filter((result): result is string => Boolean(result));
  const closing = manual
    ? manualWorkerClosing(run.id, task.assigneeId)
    : "Report a concise outcome when the task is complete.";
  return [
    "You are a worker in an approved cmdSpace Canvas orchestration.",
    `Overall goal: ${run.manifest.goal}`,
    `Task: ${task.title}`,
    `Instructions: ${task.instructions}`,
    `Done when: ${task.doneWhen}`,
    dependencies.length > 0 ? `Dependency reports:\n${dependencies.join("\n\n")}` : "",
    drainInstruction(run.id, task.assigneeId),
    closing,
  ].filter(Boolean).join("\n\n");
}

export function drainInstruction(runId: string, agentId: string): string {
  const inbox = `~/.cmdspace/orchestration/${runId}/agents/${agentId}/inbox`;
  return [
    `Drain your inbox before starting and after finishing each step: read ${inbox}/*.json,`,
    `act on each message, then move handled files to ${inbox}/.done/ (never delete).`,
  ].join("\n");
}

export function manualWorkerClosing(runId: string, agentId: string): string {
  const hive = `~/.cmdspace/orchestration/${runId}`;
  return [
    "No structured session is attached: do the work in the task worktree.",
    `Hive files: read ${hive}/PROTOCOL.md, ${hive}/registry.json, ${hive}/board.md, ${hive}/tasks.json.`,
    `Check ${hive}/agents/${agentId}/inbox/ before starting and after each step.`,
    `To message the team, write one json file into ${hive}/agents/${agentId}/outbox/ (see PROTOCOL.md for the shape); delivery is automatic on the next inbox read.`,
    `When done, write a done mail to orchestrator with your concise outcome, or report it so the coordinator can complete the task.`,
  ].join("\n");
}
