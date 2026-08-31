use super::{AgentChatConfigRow, AgentModelCacheRow, DbState};
use rusqlite::{params, OptionalExtension};

#[tauri::command]
pub fn db_load_agent_chat_config(
    state: tauri::State<'_, DbState>,
    chat_id: String,
) -> Result<Option<AgentChatConfigRow>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    conn.query_row(
        "SELECT chat_id, provider, model, effort, permission_mode, fast_mode, plan_mode FROM agent_chat_configs WHERE chat_id = ?1",
        [&chat_id],
        |row| Ok(AgentChatConfigRow {
            chat_id: row.get(0)?, provider: row.get(1)?, model: row.get(2)?, effort: row.get(3)?, permission_mode: row.get(4)?, fast_mode: row.get::<_, i64>(5)? != 0, plan_mode: row.get::<_, i64>(6)? != 0,
        }),
    )
    .optional()
    .map_err(|e| format!("Failed to load agent chat config: {e}"))
}

#[tauri::command]
pub fn db_save_agent_chat_config(
    state: tauri::State<'_, DbState>,
    config: AgentChatConfigRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    conn.execute(
        "INSERT INTO agent_chat_configs (chat_id, provider, model, effort, permission_mode, fast_mode, plan_mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(chat_id) DO UPDATE SET provider=excluded.provider, model=excluded.model, effort=excluded.effort, permission_mode=excluded.permission_mode, fast_mode=excluded.fast_mode, plan_mode=excluded.plan_mode",
        params![config.chat_id, config.provider, config.model, config.effort, config.permission_mode, config.fast_mode as i64, config.plan_mode as i64],
    )
    .map_err(|e| format!("Failed to save agent chat config: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn db_load_agent_model_cache(
    state: tauri::State<'_, DbState>,
    provider: String,
) -> Result<Option<AgentModelCacheRow>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    conn.query_row(
        "SELECT models_json, updated_at FROM agent_model_cache WHERE provider = ?1",
        [&provider],
        |row| {
            let models_json: String = row.get(0)?;
            let models = serde_json::from_str(&models_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            Ok(AgentModelCacheRow {
                provider: provider.clone(),
                models,
                updated_at: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("Failed to load agent model cache: {e}"))
}

#[tauri::command]
pub fn db_save_agent_model_cache(
    state: tauri::State<'_, DbState>,
    cache: AgentModelCacheRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    let models_json = serde_json::to_string(&cache.models)
        .map_err(|e| format!("Failed to encode agent model cache: {e}"))?;
    conn.execute(
        "INSERT INTO agent_model_cache (provider, models_json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(provider) DO UPDATE SET models_json=excluded.models_json, updated_at=excluded.updated_at",
        params![cache.provider, models_json, cache.updated_at],
    )
    .map_err(|e| format!("Failed to save agent model cache: {e}"))?;
    Ok(())
}
