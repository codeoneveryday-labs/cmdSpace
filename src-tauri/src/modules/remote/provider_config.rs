use std::path::PathBuf;

pub(super) fn remote_configured_agent_ids() -> (Vec<String>, Vec<String>) {
    let Ok(contents) = std::fs::read_to_string(remote_settings_store_path()) else {
        return (Vec::new(), Vec::new());
    };
    let Ok(store) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return (Vec::new(), Vec::new());
    };
    configured_agent_ids_from_store(&store)
}

fn remote_settings_store_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    path.push("cmdspace-settings.json");
    path
}

fn configured_agent_ids_from_store(store: &serde_json::Value) -> (Vec<String>, Vec<String>) {
    let configured = agent_ids(store, "cliAgentIds");
    let disabled = agent_ids(store, "disabledCliAgentIds");
    (configured, disabled)
}

fn agent_ids(store: &serde_json::Value, key: &str) -> Vec<String> {
    store
        .get(key)
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::configured_agent_ids_from_store;

    #[test]
    fn reads_configured_and_disabled_agent_ids() {
        let store = serde_json::json!({
            "cliAgentIds": ["codex", "claude", 42],
            "disabledCliAgentIds": ["claude"]
        });

        assert_eq!(
            configured_agent_ids_from_store(&store),
            (
                vec!["codex".to_string(), "claude".to_string()],
                vec!["claude".to_string()]
            )
        );
    }

    #[test]
    fn treats_missing_or_non_array_settings_as_empty() {
        let store = serde_json::json!({
            "cliAgentIds": "codex",
            "disabledCliAgentIds": null
        });

        assert_eq!(
            configured_agent_ids_from_store(&store),
            (Vec::new(), Vec::new())
        );
    }
}
