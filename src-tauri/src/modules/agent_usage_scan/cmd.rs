use std::path::Path;

use super::super::AgentUsageStatus;
use super::files::{codex_session_matches_cwd, newest_jsonl_files, tail_lines};
use super::parsers::parse_cmd_status;
use super::{
    opencode_models_context_window, sort_session_files, status_with_model_window, with_session_id,
};

pub(super) fn scan(
    home: &Path,
    cwd: &str,
    session_started_at_ms: Option<u64>,
) -> Option<AgentUsageStatus> {
    let root = home.join(".commandcode").join("projects");
    for file in sort_session_files(newest_jsonl_files(&root, 3), session_started_at_ms) {
        if file
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with(".checkpoints.jsonl"))
        {
            continue;
        }
        if !codex_session_matches_cwd(&file, cwd) {
            continue;
        }
        if let Some((tokens, model)) = tail_lines(&file)
            .into_iter()
            .rev()
            .find_map(|line| parse_cmd_status(&line))
        {
            let window = opencode_models_context_window(home, None, &model);
            return Some(with_session_id(
                status_with_model_window("cmd", tokens, &model, window),
                &file,
            ));
        }
    }
    None
}

pub(super) fn scan_exact(home: &Path, native_session_id: &str) -> Option<AgentUsageStatus> {
    let path = crate::modules::agent_chat::find_resumable_session_file(
        &home.join(".commandcode").join("projects"),
        native_session_id,
    )?;
    tail_lines(&path)
        .into_iter()
        .rev()
        .find_map(|line| parse_cmd_status(&line))
        .map(|(tokens, model)| {
            let window = opencode_models_context_window(home, None, &model);
            let mut status = status_with_model_window("cmd", tokens, &model, window);
            status.native_session_id = Some(native_session_id.to_string());
            status
        })
}
