use super::super::{OrchestrationManifest, OrchestrationRun, OrchestrationRuntime};
use super::core as implementation;
use crate::modules::db::DbState;

#[tauri::command]
pub fn orchestration_create_run(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    workspace_id: String,
    cwd: String,
    run_id: String,
    manifest: OrchestrationManifest,
) -> Result<OrchestrationRun, String> {
    implementation::create_run_impl(runtime, db, workspace_id, cwd, run_id, manifest)
}

#[tauri::command]
pub fn orchestration_update_draft(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    expected_revision: u64,
    manifest: OrchestrationManifest,
) -> Result<OrchestrationRun, String> {
    implementation::update_draft_impl(runtime, db, run_id, expected_revision, manifest)
}

#[tauri::command]
pub fn orchestration_request_revision(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    feedback: String,
) -> Result<OrchestrationRun, String> {
    implementation::request_revision_impl(runtime, db, run_id, feedback)
}

#[tauri::command]
pub fn orchestration_approve_and_start(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    expected_revision: u64,
) -> Result<OrchestrationRun, String> {
    implementation::approve_and_start_impl(runtime, db, run_id, expected_revision)
}

#[tauri::command]
pub fn orchestration_mark_interrupted(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
) -> Result<(), String> {
    implementation::mark_interrupted_impl(runtime, db)
}

#[tauri::command]
pub fn orchestration_pause(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::pause_impl(runtime, db, run_id)
}

#[tauri::command]
pub fn orchestration_resume(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::resume_impl(runtime, db, run_id)
}

#[tauri::command]
pub fn orchestration_cancel(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::cancel_impl(runtime, db, run_id)
}

#[tauri::command]
pub fn orchestration_retry_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
) -> Result<OrchestrationRun, String> {
    implementation::retry_task_impl(runtime, db, run_id, task_id)
}
