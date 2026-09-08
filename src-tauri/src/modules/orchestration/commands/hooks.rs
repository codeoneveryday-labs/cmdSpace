use super::super::{breaker, hook_drain, wake, OrchestrationRuntime};
use super::core as implementation;
use crate::modules::db::DbState;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn orchestration_hook_drain(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    kind: hook_drain::HookKind,
    message: Option<String>,
    tool: Option<String>,
    session_id: Option<String>,
) -> Result<hook_drain::DrainDecision, String> {
    implementation::hook_drain_impl(
        runtime, db, run_id, agent_id, kind, message, tool, session_id,
    )
}
#[tauri::command]
pub fn orchestration_wake_note_spawn(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    pty_id: String,
) -> Result<(), String> {
    implementation::wake_note_spawn_impl(runtime, pty_id)
}
#[tauri::command]
pub fn orchestration_wake_note_hook(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_id: String,
    event: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    implementation::wake_note_hook_impl(runtime, agent_id, event, message)
}
#[tauri::command]
pub fn orchestration_wake_decide(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    workers: Vec<wake::WakeFacts>,
) -> Result<Vec<wake::WakeCandidate>, String> {
    implementation::wake_decide_impl(runtime, run_id, workers)
}
#[tauri::command]
pub fn orchestration_wake_forget(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_id: String,
    pty_id: Option<String>,
) -> Result<(), String> {
    implementation::wake_forget_impl(runtime, agent_id, pty_id)
}
#[tauri::command]
pub fn orchestration_breaker_tick(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    input: breaker::BreakerInput,
) -> Result<breaker::BreakerDecision, String> {
    implementation::breaker_tick_impl(runtime, db, run_id, input)
}
#[tauri::command]
pub fn orchestration_breaker_level(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<breaker::BreakerLevel, String> {
    implementation::breaker_level_impl(runtime, run_id, agent_id)
}
