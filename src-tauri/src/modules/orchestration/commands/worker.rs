use super::super::{launch, memory, protocol, spawn_queue, OrchestrationRuntime};
use super::core as implementation;
use crate::modules::db::DbState;

#[tauri::command]
pub fn orchestration_resolve_launch(
    request_command: Option<String>,
    default_command: String,
    auto_flag: Option<String>,
    model: Option<String>,
) -> Result<launch::WorkerLaunch, String> {
    implementation::resolve_launch_impl(request_command, default_command, auto_flag, model)
}
#[tauri::command]
pub fn orchestration_agent_identity(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<protocol::AgentIdentity, String> {
    implementation::agent_identity_impl(runtime, run_id, agent_id)
}
#[tauri::command]
pub fn orchestration_memory_reindex(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<memory::MemoryIndexReport, String> {
    implementation::memory_reindex_impl(runtime, db, run_id)
}
#[tauri::command]
pub fn orchestration_memory_search(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<memory::MemoryHit>, String> {
    implementation::memory_search_impl(runtime, db, run_id, query, limit)
}
#[tauri::command]
pub fn orchestration_board_note(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    text: String,
) -> Result<String, String> {
    implementation::board_note_impl(runtime, db, run_id, agent_id, text)
}
#[tauri::command]
pub fn orchestration_spawn_list(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
) -> Result<Vec<spawn_queue::PendingSpawnRequest>, String> {
    implementation::spawn_list_impl(runtime, run_id)
}
#[tauri::command]
pub fn orchestration_spawn_claim(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    id: String,
) -> Result<spawn_queue::PendingSpawnRequest, String> {
    implementation::spawn_claim_impl(runtime, run_id, id)
}
