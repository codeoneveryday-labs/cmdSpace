use std::ffi::OsStr;
use std::path::Path;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::run_git;
use crate::modules::git::types::{GitOutput, TextSource, DEFAULT_TIMEOUT_SECS, MAX_FILE_BYTES};
use crate::modules::workspace::WorkspaceEnv;

pub fn git_show_text(workspace: &WorkspaceEnv, repo_root: &str, spec: &str) -> Result<TextSource> {
    let output = run_git(
        workspace,
        Some(repo_root),
        [
            OsStr::new("show"),
            OsStr::new("--no-textconv"),
            OsStr::new(spec),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git show"));
    }
    if output.exit_code != Some(0) {
        return Ok(TextSource::Missing);
    }
    Ok(decode_text(output.stdout))
}

pub fn git_stdout_line_opt<I, S>(
    workspace: &WorkspaceEnv,
    cwd: &str,
    args: I,
) -> Result<Option<String>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = run_git(workspace, Some(cwd), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git command"));
    }
    if output.exit_code != Some(0) {
        return Ok(None);
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    let line = stdout.lines().next().unwrap_or("").trim();
    if line.is_empty() {
        Ok(None)
    } else {
        Ok(Some(line.to_string()))
    }
}

/// Run git, returning multiple stdout lines (UTF-8). Empty trailing lines stripped.
pub fn git_stdout_lines<I, S>(workspace: &WorkspaceEnv, cwd: &str, args: I) -> Result<Vec<String>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = run_git(workspace, Some(cwd), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git command"));
    }
    if output.exit_code != Some(0) {
        return Ok(Vec::new());
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    Ok(stdout
        .lines()
        .map(|line| line.trim_end_matches('\r').to_string())
        .collect())
}

pub fn read_text_file(path: &Path) -> Result<TextSource> {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(TextSource::Missing),
        Err(e) => return Err(GitError::Io(e)),
    };
    if meta.file_type().is_symlink() {
        return Err(GitError::SymlinkRejected(path.to_path_buf()));
    }
    if !meta.is_file() {
        return Ok(TextSource::Missing);
    }
    let size = meta.len();
    if size > MAX_FILE_BYTES {
        return Err(GitError::FileTooLarge {
            path: path.to_path_buf(),
            size,
            max: MAX_FILE_BYTES,
        });
    }
    let bytes = std::fs::read(path)?;
    Ok(decode_text(bytes))
}

pub fn ensure_success(output: &GitOutput, context: &'static str) -> Result<()> {
    if output.timed_out {
        return Err(GitError::TimedOut(context));
    }
    if output.exit_code == Some(0) {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if let Some(err) = classify_auth_error(&stderr) {
        return Err(err);
    }
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "unknown git error".into()
    };
    Err(GitError::CommandFailed { context, detail })
}

fn classify_auth_error(stderr: &str) -> Option<GitError> {
    let lower = stderr.to_ascii_lowercase();
    if lower.contains("could not read username")
        || lower.contains("could not read password")
        || lower.contains("authentication failed")
        || lower.contains("permission denied (publickey)")
        || lower.contains("invalid credentials")
    {
        return Some(GitError::AuthRequired(
            stderr.lines().next().unwrap_or(stderr).to_string(),
        ));
    }
    if lower.contains("host key verification failed") {
        return Some(GitError::HostKeyUnverified);
    }
    None
}

fn decode_text(bytes: Vec<u8>) -> TextSource {
    let sniff_len = bytes.len().min(8192);
    if bytes[..sniff_len].contains(&0) {
        return TextSource::Binary;
    }
    match String::from_utf8(bytes) {
        Ok(text) => TextSource::Text(text),
        Err(e) => TextSource::Text(String::from_utf8_lossy(&e.into_bytes()).into_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_text, ensure_success};
    use crate::modules::git::errors::GitError;
    use crate::modules::git::types::{GitOutput, TextSource};

    fn output(stderr: &[u8], exit_code: Option<i32>) -> GitOutput {
        GitOutput {
            stdout: Vec::new(),
            stderr: stderr.to_vec(),
            exit_code,
            timed_out: false,
            truncated: false,
        }
    }

    #[test]
    fn decode_text_preserves_utf8_content() {
        match decode_text("Xin chào".as_bytes().to_vec()) {
            TextSource::Text(text) => assert_eq!(text, "Xin chào"),
            other => panic!("expected text, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn decode_text_classifies_nul_terminated_content_as_binary() {
        assert!(matches!(
            decode_text(vec![b'P', b'K', 0, b'\x03']),
            TextSource::Binary
        ));
    }

    #[test]
    fn ensure_success_classifies_authentication_failures() {
        let error = ensure_success(
            &output(b"fatal: Authentication failed", Some(128)),
            "git push failed",
        )
        .expect_err("authentication failure should be classified");
        assert!(matches!(error, GitError::AuthRequired(_)));
    }
}
