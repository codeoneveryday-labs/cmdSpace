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

pub(super) fn session_id_from_header(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let mut first_line = String::new();
    std::io::BufRead::read_line(&mut reader, &mut first_line).ok()?;
    let value = serde_json::from_str::<Value>(&first_line).ok()?;
    find_session_id(&value).map(str::to_owned)
}

pub(super) fn session_timestamp_ms_from_header(path: &Path) -> Option<u64> {
    let file = File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let mut first_line = String::new();
    std::io::BufRead::read_line(&mut reader, &mut first_line).ok()?;
    let value = serde_json::from_str::<Value>(&first_line).ok()?;
    find_timestamp(&value).and_then(parse_rfc3339_millis)
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

fn find_session_id(value: &Value) -> Option<&str> {
    match value {
        Value::Object(values) => values
            .get("session_id")
            .or_else(|| values.get("sessionId"))
            .or_else(|| values.get("id"))
            .and_then(Value::as_str)
            .or_else(|| values.values().find_map(find_session_id)),
        Value::Array(values) => values.iter().find_map(find_session_id),
        _ => None,
    }
}

fn find_timestamp(value: &Value) -> Option<&str> {
    match value {
        Value::Object(values) => values
            .get("timestamp")
            .and_then(Value::as_str)
            .or_else(|| values.values().find_map(find_timestamp)),
        Value::Array(values) => values.iter().find_map(find_timestamp),
        _ => None,
    }
}

fn parse_rfc3339_millis(value: &str) -> Option<u64> {
    let bytes = value.as_bytes();
    if bytes.len() < 20 || bytes[4] != b'-' || bytes[7] != b'-' || bytes[10] != b'T' {
        return None;
    }
    let year = parse_digits(bytes, 0, 4)? as i64;
    let month = parse_digits(bytes, 5, 2)? as i64;
    let day = parse_digits(bytes, 8, 2)? as i64;
    let hour = parse_digits(bytes, 11, 2)? as i64;
    let minute = parse_digits(bytes, 14, 2)? as i64;
    let second = parse_digits(bytes, 17, 2)? as i64;
    if bytes.get(19) != Some(&b'Z') && bytes.get(19) != Some(&b'.') {
        return None;
    }
    let fraction_start = if bytes[19] == b'.' { 20 } else { 19 };
    let fraction_end = bytes[fraction_start..]
        .iter()
        .position(|byte| *byte == b'Z' || *byte == b'+' || *byte == b'-')
        .map(|offset| fraction_start + offset)
        .unwrap_or(bytes.len());
    let fraction = if fraction_start < fraction_end {
        let digits = &bytes[fraction_start..fraction_end];
        let millis = parse_digits_prefix(digits, 3)?;
        millis * 10u64.pow(3u32.saturating_sub(digits.len().min(3) as u32))
    } else {
        0
    };
    let days = days_from_civil(year, month, day)?;
    let seconds = days
        .checked_mul(86_400)?
        .checked_add(hour * 3_600 + minute * 60 + second)?;
    u64::try_from(
        seconds
            .checked_mul(1_000)?
            .checked_add(i64::try_from(fraction).ok()?)?,
    )
    .ok()
}

fn parse_digits(bytes: &[u8], start: usize, length: usize) -> Option<u64> {
    bytes
        .get(start..start + length)?
        .iter()
        .try_fold(0u64, |value, byte| {
            let digit = byte.checked_sub(b'0')?;
            (digit <= 9).then_some(value * 10 + u64::from(digit))
        })
}

fn parse_digits_prefix(bytes: &[u8], length: usize) -> Option<u64> {
    let count = bytes.len().min(length);
    parse_digits(bytes, 0, count)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> Option<i64> {
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let adjusted_year = year - i64::from(month <= 2);
    let era = (if adjusted_year >= 0 {
        adjusted_year
    } else {
        adjusted_year - 399
    }) / 400;
    let year_of_era = adjusted_year - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    Some(era * 146_097 + day_of_era - 719_468)
}

fn same_path(left: &str, right: &str) -> bool {
    left.trim_end_matches('/') == right.trim_end_matches('/')
}

/// Matches session lines that carry their own `cwd` (omp writes it per
/// line; cmd writes it on the session header). Unlike
/// `codex_session_matches_cwd`, this scans caller-provided lines so files
/// whose first line is a title/header without cwd still match.
pub(super) fn any_line_matches_cwd(lines: &[String], cwd: &str) -> bool {
    lines.iter().any(|line| {
        serde_json::from_str::<Value>(line)
            .ok()
            .and_then(|value| find_cwd(&value).map(str::to_owned))
            .is_some_and(|candidate| same_path(&candidate, cwd))
    })
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
