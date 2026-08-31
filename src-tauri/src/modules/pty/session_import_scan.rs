use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::{extended, ImportableAgentSession, PROVIDER_LIMIT};

pub fn list_agent_sessions_in(
    home: &Path,
    workspace_cwd: Option<&Path>,
    limit: usize,
) -> Vec<ImportableAgentSession> {
    let mut sessions = Vec::new();
    sessions.extend(list_jsonl_sessions(
        "claude",
        &home.join(".claude/projects"),
        super::parse_claude_session,
    ));
    sessions.extend(list_jsonl_sessions(
        "codex",
        &home.join(".codex/sessions"),
        super::parse_codex_session,
    ));
    sessions.extend(list_jsonl_sessions(
        "pi",
        &home.join(".pi/agent/sessions"),
        super::parse_pi_session,
    ));
    sessions.extend(super::list_opencode_sessions(
        &home.join(".local/share/opencode/opencode.db"),
    ));
    sessions.extend(extended::list_extended_sessions(home, workspace_cwd));
    sessions.sort_by_key(|session| std::cmp::Reverse(session.last_activity_at));
    sessions.truncate(limit);
    sessions
}

fn list_jsonl_sessions(
    provider: &'static str,
    root: &Path,
    parse: fn(&Path, u64) -> Option<ImportableAgentSession>,
) -> Vec<ImportableAgentSession> {
    let mut files = Vec::new();
    collect_jsonl_files(root, &mut files);
    files.sort_by_key(|path| std::cmp::Reverse(file_mtime_ms(path)));
    files
        .into_iter()
        .take(PROVIDER_LIMIT * 4)
        .filter_map(|path| parse(&path, file_mtime_ms(&path)))
        .filter(|session| session.provider == provider)
        .take(PROVIDER_LIMIT)
        .collect()
}

fn collect_jsonl_files(root: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            collect_jsonl_files(&path, files);
        } else if file_type.is_file() && path.extension().is_some_and(|ext| ext == "jsonl") {
            files.push(path);
        }
    }
}

pub fn file_mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

pub fn jsonl_values(path: &Path) -> impl Iterator<Item = serde_json::Value> {
    File::open(path)
        .ok()
        .into_iter()
        .flat_map(|file| BufReader::new(file).lines().map_while(Result::ok))
        .filter_map(|line| serde_json::from_str(&line).ok())
}
