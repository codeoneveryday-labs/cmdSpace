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

export type OrchestrationHiveAct =
  | "request"
  | "inform"
  | "propose"
  | "query"
  | "agree"
  | "refuse"
  | "done";

export type OrchestrationHiveMessage = {
  id: string;
  conversation: string;
  inReplyTo: string | null;
  from: string;
  to: string;
  act: OrchestrationHiveAct;
  subject: string;
  body: string;
  hops: number;
  requiresReply: boolean;
  needsHuman: boolean;
  createdAt: number;
};

export type OrchestrationRouteReport = {
  delivered: Array<{ messageId: string; from: string; to: string }>;
  skipped: string[];
};

export type OrchestrationMailUnread = {
  unreadIds: string[];
  total: number;
  lastProcessed: string | null;
};

export const ORCHESTRATION_MAIL_ORCHESTRATOR_ID = "orchestrator";
export const ORCHESTRATION_MAIL_BROADCAST = "broadcast";

export type OrchestrationMemoryHit = {
  agentId: string;
  source: string;
  snippet: string;
};

export type OrchestrationMemoryIndexReport = {
  indexed: number;
  skippedUnchanged: number;
};

export type OrchestrationBreakerLevel =
  | "healthy"
  | "steering"
  | "constrained"
  | "stopped";

export type OrchestrationBreakerAction = "none" | "steer" | "constrain" | "stop";

export type OrchestrationBreakerSample = {
  input: number;
  output: number;
  errors: number;
  repeatKey?: string | null;
};

export type OrchestrationBreakerInput = {
  agentId: string;
  sample?: OrchestrationBreakerSample | null;
  progressing: boolean;
};

export type OrchestrationBreakerDecision = {
  state: {
    agentId: string;
    level: OrchestrationBreakerLevel;
    reason: string;
    ts: number;
  };
  action: OrchestrationBreakerAction;
  changed: boolean;
};

export type OrchestrationHookKind =
  | "stop"
  | "notification"
  | "preToolUse"
  | "postToolUse"
  | "sessionStart"
  | "status";

export type OrchestrationAgentLiveness = "working" | "idle" | "waitingInput";

export type OrchestrationDrainDecision =
  | { allowStop: true }
  | { nudge: string }
  | { delivered: number };

export type OrchestrationSpawnRequest = {
  objective: string;
  cwd?: string | null;
  name?: string | null;
  command?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type OrchestrationPendingSpawn = {
  id: string;
  request: OrchestrationSpawnRequest;
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
    activityLog(runId: string, limit?: number) {
      return invoke<OrchestrationEvent[]>("orchestration_activity_log", {
        runId,
        limit: limit ?? 200,
      });
    },
    reportHook(input: {
      runId: string;
      agentId: string;
      kind: OrchestrationHookKind;
      message?: string | null;
      tool?: string | null;
      sessionId?: string | null;
    }) {
      return invoke<unknown>("orchestration_hook_drain", {
        runId: input.runId,
        agentId: input.agentId,
        kind: input.kind,
        message: input.message ?? null,
        tool: input.tool ?? null,
        sessionId: input.sessionId ?? null,
      });
    },
    sendMail(input: {
      runId: string;
      from: string;
      to: string;
      act: OrchestrationHiveAct;
      subject: string;
      body: string;
      conversation?: string | null;
      inReplyTo?: string | null;
    }) {
      return invoke<OrchestrationHiveMessage>("orchestration_mail_send", {
        runId: input.runId,
        from: input.from,
        to: input.to,
        act: input.act,
        subject: input.subject,
        body: input.body,
        conversation: input.conversation ?? null,
        inReplyTo: input.inReplyTo ?? null,
      });
    },
    loadUnread(runId: string, agentId: string) {
      return invoke<OrchestrationMailUnread>("orchestration_mail_unread", {
        runId,
        agentId,
      });
    },
    loadInbox(runId: string, agentId: string) {
      return invoke<OrchestrationHiveMessage[]>("orchestration_mail_inbox", {
        runId,
        agentId,
      });
    },
    ackMail(runId: string, agentId: string, messageId: string) {
      return invoke<OrchestrationHiveMessage[]>("orchestration_mail_ack", {
        runId,
        agentId,
        messageId,
      });
    },
    routeMail(runId: string) {
      return invoke<OrchestrationRouteReport>("orchestration_mail_route", { runId });
    },
    reindexMemories(runId: string) {
      return invoke<OrchestrationMemoryIndexReport>("orchestration_memory_reindex", {
        runId,
      });
    },
    searchMemories(runId: string, query: string, limit = 8) {
      return invoke<OrchestrationMemoryHit[]>("orchestration_memory_search", {
        runId,
        query,
        limit,
      });
    },
    breakerTick(runId: string, input: OrchestrationBreakerInput) {
      return invoke<OrchestrationBreakerDecision>("orchestration_breaker_tick", {
        runId,
        input,
      });
    },
    breakerLevel(runId: string, agentId: string) {
      return invoke<OrchestrationBreakerLevel>("orchestration_breaker_level", {
        runId,
        agentId,
      });
    },
    breakerBeat(runId: string, inputs: OrchestrationBreakerInput[]) {
      return invoke<OrchestrationBreakerDecision[]>(
        "orchestration_breaker_beat",
        { runId, inputs },
      );
    },
    finalizeRun(runId: string) {
      return invoke<unknown>("orchestration_finalize_run", { runId });
    },
    listSpawnRequests(runId: string) {
      return invoke<OrchestrationPendingSpawn[]>("orchestration_spawn_list", {
        runId,
      });
    },
    claimSpawnRequest(runId: string, id: string) {
      return invoke<OrchestrationPendingSpawn>("orchestration_spawn_claim", {
        runId,
        id,
      });
    },
  };
}
