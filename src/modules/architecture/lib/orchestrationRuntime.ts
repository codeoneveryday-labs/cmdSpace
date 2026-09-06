import { Channel, invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";
import type { OrchestrationManifestV1 } from "./orchestrationManifest";

export type OrchestrationRunStatus =
  | "awaiting_approval"
  | "running"
  | "paused"
  | "review_required"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type OrchestrationTaskStatus =
  | "draft"
  | "queued"
  | "running"
  | "validating"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "interrupted";

export type OrchestrationRun = {
  id: string;
  workspaceId: string;
  cwd: string;
  sourceCommit: string | null;
  integrationBranch: string | null;
  integrationWorktree: string | null;
  revision: number;
  status: OrchestrationRunStatus;
  manifest: OrchestrationManifestV1;
  tasks: Array<{
    taskId: string;
    status: OrchestrationTaskStatus;
    attempt: number;
    result: string | null;
    chatId: string | null;
    runtimeSessionId: string | null;
    branchName: string | null;
    worktreePath: string | null;
  }>;
};

export type OrchestrationEvent = {
  sequence: number;
  runId: string;
  taskId: string | null;
  eventType: string;
  timestamp: number;
  payload: unknown;
};

export function createOrchestrationRuntime(
  onEvent: (event: OrchestrationEvent) => void,
) {
  const channel = new Channel<OrchestrationEvent>();
  channel.onmessage = onEvent;
  return {
    createRun(
      workspaceId: string,
      cwd: string,
      runId: string,
      manifest: OrchestrationManifestV1,
    ) {
      return invoke<OrchestrationRun>("orchestration_create_run", {
        workspaceId,
        cwd,
        runId,
        manifest,
      });
    },
    requestRevision(runId: string, feedback: string) {
      return invoke<OrchestrationRun>("orchestration_request_revision", {
        runId,
        feedback,
      });
    },
    updateDraft(runId: string, expectedRevision: number, manifest: OrchestrationManifestV1) {
      return invoke<OrchestrationRun>("orchestration_update_draft", {
        runId,
        expectedRevision,
        manifest,
      });
    },
    approveAndStart(runId: string, expectedRevision: number) {
      return invoke<OrchestrationRun>("orchestration_approve_and_start", {
        runId,
        expectedRevision,
      });
    },
    prepareTaskWorktree(runId: string, taskId: string) {
      return invoke<OrchestrationRun>("orchestration_prepare_task_worktree", {
        runId,
        taskId,
        workspace: currentWorkspaceEnv(),
      });
    },
    completeTask(runId: string, taskId: string, result: string) {
      return invoke<OrchestrationRun>("orchestration_complete_task", {
        runId,
        taskId,
        result,
        workspace: currentWorkspaceEnv(),
      });
    },
    failTask(runId: string, taskId: string, error: string) {
      return invoke<OrchestrationRun>("orchestration_fail_task", {
        runId,
        taskId,
        error,
      });
    },
    bindTaskSession(runId: string, taskId: string, chatId: string, runtimeSessionId: string) {
      return invoke<OrchestrationRun>("orchestration_bind_task_session", {
        runId,
        taskId,
        chatId,
        runtimeSessionId,
      });
    },
    pause(runId: string) {
      return invoke<OrchestrationRun>("orchestration_pause", { runId });
    },
    resume(runId: string) {
      return invoke<OrchestrationRun>("orchestration_resume", { runId });
    },
    cancel(runId: string) {
      return invoke<OrchestrationRun>("orchestration_cancel", { runId });
    },
    retryTask(runId: string, taskId: string) {
      return invoke<OrchestrationRun>("orchestration_retry_task", { runId, taskId });
    },
    snapshot(runId: string) {
      return invoke<OrchestrationRun>("orchestration_snapshot", { runId });
    },
    attach(runId: string) {
      return invoke<string>("orchestration_attach", { runId, onEvent: channel });
    },
    detach(runId: string, attachmentToken: string) {
      return invoke<void>("orchestration_detach", { runId, attachmentToken });
    },
  };
}
