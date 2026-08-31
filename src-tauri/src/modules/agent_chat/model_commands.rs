use super::models;
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};

#[tauri::command]
pub fn agent_chat_list_models(
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<models::AgentChatModel>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
        .ok_or_else(|| "Model discovery requires a working folder".to_string())?;
    models::list_models(&provider, &cwd)
}

#[tauri::command]
pub fn agent_chat_list_slash_options(
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    command: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<models::AgentChatModel>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
        .ok_or_else(|| "Agent control discovery requires a working folder".to_string())?;
    models::list_slash_options(&provider, &cwd, &command)
}
