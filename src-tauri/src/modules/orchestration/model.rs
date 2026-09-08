use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type OrchestrationProvider = String;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSpec {
    pub id: String,
    pub name: String,
    pub role: String,
    pub provider: OrchestrationProvider,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestratorSpec {
    pub provider: OrchestrationProvider,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSpec {
    pub id: String,
    pub title: String,
    pub instructions: String,
    pub assignee_id: String,
    pub depends_on: Vec<String>,
    pub write_access: bool,
    pub done_when: String,
    pub validation_commands: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationManifest {
    pub version: u32,
    pub title: String,
    pub goal: String,
    pub orchestrator: OrchestratorSpec,
    pub agents: Vec<AgentSpec>,
    pub tasks: Vec<TaskSpec>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationRunStatus {
    AwaitingApproval,
    Running,
    Paused,
    ReviewRequired,
    Completed,
    Failed,
    Cancelled,
    Interrupted,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationTaskStatus {
    Draft,
    Queued,
    Running,
    Validating,
    Completed,
    Blocked,
    Failed,
    Cancelled,
    Interrupted,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecution {
    pub task_id: String,
    pub status: OrchestrationTaskStatus,
    pub attempt: u32,
    pub result: Option<String>,
    pub chat_id: Option<String>,
    pub runtime_session_id: Option<String>,
    pub branch_name: Option<String>,
    pub worktree_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationRun {
    pub id: String,
    pub workspace_id: String,
    pub cwd: String,
    pub source_commit: Option<String>,
    pub integration_branch: Option<String>,
    pub integration_worktree: Option<String>,
    pub revision: u64,
    pub status: OrchestrationRunStatus,
    pub manifest: OrchestrationManifest,
    pub tasks: Vec<TaskExecution>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationEventType {
    RunCreated,
    DraftUpdated,
    RevisionRequested,
    Approved,
    TaskStarted,
    TaskCompleted,
    TaskFailed,
    TaskBlocked,
    TaskActivity,
    MailSent,
    MailRouted,
    MailAcknowledged,
    HookReceived,
    SessionRecorded,
    BreakerTripped,
    RunPaused,
    RunResumed,
    RunCancelled,
    Interrupted,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationEvent {
    pub sequence: u64,
    pub run_id: String,
    pub task_id: Option<String>,
    pub event_type: OrchestrationEventType,
    pub timestamp: i64,
    pub payload: Value,
}
