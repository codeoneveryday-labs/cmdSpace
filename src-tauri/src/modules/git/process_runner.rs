use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use shared_child::SharedChild;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::types::{GitOutput, MAX_OUTPUT_BYTES, MAX_TIMEOUT_SECS};
use crate::modules::workspace::WorkspaceEnv;

pub fn run_git<I, S>(
    workspace: &WorkspaceEnv,
    cwd: Option<&str>,
    args: I,
    timeout_secs: u64,
) -> Result<GitOutput>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    run_git_uncached(workspace, cwd, args, timeout_secs)
}

pub fn run_git_uncached<I, S>(
    workspace: &WorkspaceEnv,
    cwd: Option<&str>,
    args: I,
    timeout_secs: u64,
) -> Result<GitOutput>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let dur = Duration::from_secs(timeout_secs.clamp(1, MAX_TIMEOUT_SECS));
    let args: Vec<OsString> = args
        .into_iter()
        .map(|arg| arg.as_ref().to_os_string())
        .collect();
    let mut cmd = build_git_command(workspace, cwd, &args)?;
    cmd.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("GCM_PROVIDER", "")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut cmd);

    let child = Arc::new(SharedChild::spawn(&mut cmd).map_err(|e| GitError::Spawn(e.to_string()))?);
    let mut stdout_pipe = child
        .take_stdout()
        .ok_or_else(|| GitError::Spawn("no stdout pipe".into()))?;
    let mut stderr_pipe = child
        .take_stderr()
        .ok_or_else(|| GitError::Spawn("no stderr pipe".into()))?;

    let stdout_handle = thread::spawn(move || drain(&mut stdout_pipe, 64 * 1024));
    let stderr_handle = thread::spawn(move || drain(&mut stderr_pipe, 4 * 1024));

    let (tx, rx) = mpsc::channel();
    let waiter = Arc::clone(&child);
    thread::spawn(move || {
        let _ = tx.send(waiter.wait());
    });

    let (exit_code, timed_out) = match rx.recv_timeout(dur) {
        Ok(Ok(status)) => (status.code(), false),
        Ok(Err(e)) => return Err(GitError::Io(e)),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            let _ = child.kill();
            let _ = child.wait();
            (None, true)
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            return Err(GitError::Spawn("git wait thread disconnected".into()));
        }
    };

    let (stdout, stdout_truncated) = stdout_handle.join().unwrap_or((Vec::new(), false));
    let (stderr, _stderr_truncated) = stderr_handle.join().unwrap_or((Vec::new(), false));

    Ok(GitOutput {
        stdout,
        stderr,
        exit_code,
        timed_out,
        truncated: stdout_truncated,
    })
}

pub fn build_git_command(
    _workspace: &WorkspaceEnv,
    cwd: Option<&str>,
    args: &[OsString],
) -> Result<Command> {
    #[cfg(windows)]
    if let WorkspaceEnv::Wsl { distro } = _workspace {
        crate::modules::workspace::validate_wsl_distro_name(distro)
            .map_err(|_| GitError::command("unsafe WSL distro name", distro.clone()))?;
        let mut cmd = Command::new("wsl.exe");
        cmd.arg("-d").arg(distro);
        if let Some(cwd) = cwd.filter(|s| !s.is_empty()) {
            cmd.arg("--cd").arg(cwd);
        }
        cmd.arg("--exec").arg("git");
        cmd.args(args);
        return Ok(cmd);
    }

    let mut cmd = Command::new("git");
    cmd.args(args);
    if let Some(dir) = cwd.filter(|s| !s.is_empty()) {
        cmd.current_dir(Path::new(dir));
    }
    Ok(cmd)
}

fn drain<R: Read>(reader: &mut R, prealloc: usize) -> (Vec<u8>, bool) {
    let mut out: Vec<u8> = Vec::with_capacity(prealloc.min(MAX_OUTPUT_BYTES));
    let mut buf = [0u8; 16 * 1024];
    let mut truncated = false;
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if out.len() >= MAX_OUTPUT_BYTES {
                    truncated = true;
                    continue;
                }
                let take = (MAX_OUTPUT_BYTES - out.len()).min(n);
                out.extend_from_slice(&buf[..take]);
                if take < n {
                    truncated = true;
                }
            }
            Err(_) => break,
        }
    }
    (out, truncated)
}

#[cfg(all(test, windows))]
mod tests {
    use super::build_git_command;
    use crate::modules::workspace::WorkspaceEnv;
    use std::ffi::OsString;

    #[test]
    fn builds_wsl_git_command_with_cd_and_exec() {
        let cmd = build_git_command(
            &WorkspaceEnv::Wsl {
                distro: "Ubuntu".into(),
            },
            Some("/home/vinicios/Nova pasta/repo"),
            &[OsString::from("status"), OsString::from("--short")],
        )
        .expect("valid WSL distro");
        let program = cmd.get_program().to_string_lossy().into_owned();
        let args: Vec<String> = cmd
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert_eq!(program, "wsl.exe");
        assert_eq!(
            args,
            vec![
                "-d",
                "Ubuntu",
                "--cd",
                "/home/vinicios/Nova pasta/repo",
                "--exec",
                "git",
                "status",
                "--short",
            ]
        );
    }

    #[test]
    fn rejects_unsafe_wsl_distro_name_for_git_command() {
        let err = build_git_command(
            &WorkspaceEnv::Wsl {
                distro: "../Ubuntu".into(),
            },
            None,
            &[],
        )
        .unwrap_err();
        assert!(err.to_string().contains("unsafe WSL distro name"));
    }
}
