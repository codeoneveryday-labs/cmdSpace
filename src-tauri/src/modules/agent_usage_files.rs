use std::cmp::Reverse;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde_json::Value;

const MAX_SESSION_FILES: usize = 384;
const MAX_TAIL_BYTES: u64 = 512 * 1024;

pub(super) fn codex_session_matches_cwd(path: &Path, cwd: &str) -> bool {
    let Ok(file) = File::open(path) else {
        return false;
    };
    let mut first_line = String::new();
    let mut reader = std::io::BufReader::new(file);
    if std::io::BufRead::read_line(&mut reader, &mut first_line).is_err() {
        return false;
    }
    let Ok(value) = serde_json::from_str::<Value>(&first_line) else {
        return false;
    };
    find_cwd(&value).is_some_and(|candidate| same_path(candidate, cwd))
}

fn find_cwd(value: &Value) -> Option<&str> {
    match value {
        Value::Object(values) => values
            .get("cwd")
            .and_then(Value::as_str)
            .or_else(|| values.values().find_map(find_cwd)),
        Value::Array(values) => values.iter().find_map(find_cwd),
        _ => None,
    }
}

fn same_path(left: &str, right: &str) -> bool {
    left.trim_end_matches('/') == right.trim_end_matches('/')
}

pub(super) fn escaped_claude_cwd(cwd: &str) -> String {
    cwd.chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect()
}

pub(super) fn newest_jsonl_files(root: &Path, max_depth: u8) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_jsonl_files(root, max_depth, &mut files);
    files.sort_by_key(|path| Reverse(modified_at(path)));
    files.truncate(MAX_SESSION_FILES);
    files
}

fn collect_jsonl_files(root: &Path, depth: u8, files: &mut Vec<PathBuf>) {
    if depth == 0 || files.len() >= MAX_SESSION_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut entries: Vec<_> = entries.flatten().collect();
    // Session folders are date-named. Descending traversal makes the cap
    // deterministic and strongly favors the active/recent session.
    entries.sort_by_key(|entry| Reverse(entry.file_name()));
    for entry in entries {
        if files.len() >= MAX_SESSION_FILES {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, depth - 1, files);
        } else if path
            .extension()
            .is_some_and(|extension| extension == "jsonl")
        {
            files.push(path);
        }
    }
}

pub(super) fn modified_at(path: &Path) -> u64 {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .and_then(|time| {
            time.duration_since(UNIX_EPOCH)
                .map_err(std::io::Error::other)
        })
        .unwrap_or_default()
        .as_secs()
}

pub(super) fn tail_lines(path: &Path) -> Vec<String> {
    tail_lines_with_limit(path, MAX_TAIL_BYTES)
}

pub(super) fn tail_lines_with_limit(path: &Path, max_tail_bytes: u64) -> Vec<String> {
    let Ok(mut file) = File::open(path) else {
        return Vec::new();
    };
    let Ok(length) = file.metadata().map(|metadata| metadata.len()) else {
        return Vec::new();
    };
    let start = length.saturating_sub(max_tail_bytes);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return Vec::new();
    }
    let mut content = String::new();
    if file.read_to_string(&mut content).is_err() {
        return Vec::new();
    }
    let mut lines: Vec<String> = content.lines().map(str::to_owned).collect();
    if start > 0 && !lines.is_empty() {
        lines.remove(0);
    }
    lines
}

#[cfg(test)]
pub(super) const fn terminal_usage_tail_bytes() -> u64 {
    MAX_TAIL_BYTES
}
