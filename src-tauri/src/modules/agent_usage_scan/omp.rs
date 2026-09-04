use std::path::Path;

use super::super::AgentUsageStatus;
use super::files::{any_line_matches_cwd, newest_jsonl_files, tail_lines};
use super::parsers::{models_context_window, parse_omp_status};
use super::{sort_session_files, status_with_model_window, with_session_id};

pub(super) fn scan(
    home: &Path,
    cwd: &str,
    session_started_at_ms: Option<u64>,
) -> Option<AgentUsageStatus> {
    let root = home.join(".omp").join("agent").join("sessions");
    for file in sort_session_files(newest_jsonl_files(&root, 3), session_started_at_ms) {
        let lines = tail_lines(&file);
        if !any_line_matches_cwd(&lines, cwd) {
            continue;
        }
        if let Some((tokens, model)) = lines.iter().rev().find_map(|line| parse_omp_status(line)) {
            let window = model_context_window(home, &model);
            return Some(with_session_id(
                status_with_model_window("omp", tokens, &model, window),
                &file,
            ));
        }
    }
    None
}

pub(super) fn scan_exact(home: &Path, native_session_id: &str) -> Option<AgentUsageStatus> {
    let path = crate::modules::agent_chat::find_resumable_session_file(
        &home.join(".omp").join("agent").join("sessions"),
        native_session_id,
    )?;
    tail_lines(&path)
        .into_iter()
        .rev()
        .find_map(|line| parse_omp_status(&line))
        .map(|(tokens, model)| {
            let window = model_context_window(home, &model);
            let mut status = status_with_model_window("omp", tokens, &model, window);
            status.native_session_id = Some(native_session_id.to_string());
            status
        })
}

fn model_context_window(home: &Path, model: &str) -> Option<u64> {
    let connection = rusqlite::Connection::open_with_flags(
        home.join(".omp").join("agent").join("models.db"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    let windows: Vec<String> = {
        let mut statement = connection.prepare("SELECT models FROM model_cache").ok()?;
        let rows = match statement.query_map([], |row| row.get::<_, String>(0)) {
            Ok(rows) => rows,
            Err(_) => return None,
        };
        rows.flatten().collect()
    };
    windows
        .iter()
        .filter_map(|models_json| models_context_window(models_json, model))
        .next()
}
