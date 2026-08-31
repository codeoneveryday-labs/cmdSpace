use super::super::adapter::AdapterKind;
use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::CommandCodeJson,
    program: "cmd",
    launch_args: &["--output-format", "json", "--yolo"],
    // Discovery is a headless probe. Avoid loading/resuming persisted state or
    // interactive onboarding, both of which can leave the CLI waiting without
    // producing the model list when launched from the desktop app.
    model_discovery: ModelDiscovery::Command(&[
        "--no-session",
        "--skip-onboarding",
        "--list-models",
    ]),
    control_discovery: ControlDiscovery::Cmd,
};

pub(crate) fn headless_exit_message(exit_code: Option<i32>) -> Option<&'static str> {
    match exit_code {
        Some(5) => Some(
            "Command Code is rate limited. Wait a moment and retry, or check /usage for your current limit.",
        ),
        Some(10) => Some(
            "Command Code has insufficient credits. Check /usage or add on-demand credits with /extra.",
        ),
        _ => None,
    }
}

pub(crate) fn materialize_headless_transcript(
    cwd: &Path,
    line: &str,
) -> Result<Option<String>, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Unable to locate the Command Code home directory".to_string())?;
    materialize_headless_transcript_in(&home.join(".commandcode").join("projects"), cwd, line)
}

pub(crate) fn materialize_headless_transcript_in(
    sessions_root: &Path,
    cwd: &Path,
    line: &str,
) -> Result<Option<String>, String> {
    let value: Value = serde_json::from_str(line).map_err(|error| error.to_string())?;
    let Some(next_state) = value.pointer("/event/result/nextState") else {
        return Ok(None);
    };
    if value.pointer("/event/type").and_then(Value::as_str) != Some("run_end") {
        return Ok(None);
    }
    let Some(session_id) = next_state.get("sessionId").and_then(Value::as_str) else {
        return Ok(None);
    };
    let Some(messages) = next_state.get("messages").and_then(Value::as_array) else {
        return Ok(None);
    };
    let Some(path) = find_transcript(sessions_root, session_id)? else {
        return Err(format!(
            "Command Code transcript for session '{session_id}' was not created"
        ));
    };
    if std::fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len()
        > 0
    {
        return Ok(Some(session_id.to_string()));
    }

    let mut records = Vec::with_capacity(messages.len() + 1);
    records.push(json!({
        "type": "session",
        "version": 3,
        "id": session_id,
        "timestamp": "1970-01-01T00:00:00.000Z",
        "cwd": cwd,
    }));
    let mut parent_id = None;
    for message in messages {
        let entry_id = message
            .pointer("/meta/messageId")
            .and_then(Value::as_str)
            .map(|id| id.chars().take(8).collect::<String>())
            .filter(|id| !id.is_empty())
            .unwrap_or_else(|| format!("message-{}", records.len()));
        records.push(json!({
            "type": "message",
            "id": entry_id,
            "parentId": parent_id,
            "message": message,
        }));
        parent_id = records
            .last()
            .and_then(|record| record.get("id"))
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    let contents = records
        .into_iter()
        .map(|record| serde_json::to_string(&record).map_err(|error| error.to_string()))
        .collect::<Result<Vec<_>, _>>()?
        .join("\n");
    std::fs::write(&path, format!("{contents}\n")).map_err(|error| error.to_string())?;
    Ok(Some(session_id.to_string()))
}

fn find_transcript(root: &Path, session_id: &str) -> Result<Option<PathBuf>, String> {
    for entry in std::fs::read_dir(root).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_dir() {
            if let Some(found) = find_transcript(&path, session_id)? {
                return Ok(Some(found));
            }
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl")
            && !path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".checkpoints.jsonl"))
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.contains(session_id))
        {
            return Ok(Some(path));
        }
    }
    Ok(None)
}
