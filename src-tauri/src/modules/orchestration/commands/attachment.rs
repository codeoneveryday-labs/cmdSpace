use super::super::{OrchestrationEvent, OrchestrationRun, OrchestrationRuntime};
use super::core as implementation;
use crate::modules::db::DbState;
use tauri::ipc::Channel;

#[tauri::command]
pub fn orchestration_snapshot(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::snapshot_impl(runtime, db, run_id)
}

#[tauri::command]
pub fn orchestration_attach(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    on_event: Channel<OrchestrationEvent>,
) -> Result<String, String> {
    implementation::attach_impl(runtime, run_id, on_event)
}

#[tauri::command]
pub fn orchestration_activity_log(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    limit: Option<usize>,
) -> Result<Vec<OrchestrationEvent>, String> {
    implementation::activity_log_impl(runtime, db, run_id, limit)
}

#[tauri::command]
pub fn orchestration_detach(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    attachment_token: Option<String>,
) -> Result<(), String> {
    implementation::detach_impl(runtime, run_id, attachment_token)
}
