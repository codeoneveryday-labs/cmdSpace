use super::super::{OrchestrationRun, OrchestrationRuntime};
use super::core as implementation;
use crate::modules::agent_chat::AgentChatRuntime;
use crate::modules::db::DbState;
use crate::modules::workspace::{WorkspaceEnv, WorkspaceRegistry};

#[tauri::command]
pub fn orchestration_prepare_task_worktree(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    registry: tauri::State<'_, WorkspaceRegistry>,
    run_id: String,
    task_id: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<OrchestrationRun, String> {
    implementation::prepare_task_worktree_impl(runtime, db, registry, run_id, task_id, workspace)
}

#[tauri::command]
pub async fn orchestration_complete_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    result: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<OrchestrationRun, String> {
    implementation::complete_task_impl(runtime, db, run_id, task_id, result, workspace).await
}

#[tauri::command]
pub fn orchestration_fail_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    error: String,
) -> Result<OrchestrationRun, String> {
    implementation::fail_task_impl(runtime, db, run_id, task_id, error)
}

#[tauri::command]
pub fn orchestration_bind_task_session(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_chat: tauri::State<'_, AgentChatRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    chat_id: String,
    runtime_session_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::bind_task_session_impl(
        runtime,
        agent_chat,
        db,
        run_id,
        task_id,
        chat_id,
        runtime_session_id,
    )
}
