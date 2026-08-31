use std::io::{BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use super::AgentChatModel;

pub fn list_flag_choices(
    program: &str,
    args: &[&str],
    cwd: &Path,
) -> Result<Vec<AgentChatModel>, String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let child = command.spawn().map_err(|error| error.to_string())?;
    let output = read_child_output_with_timeout(
        child,
        if program == "cmd" {
            super::COMMAND_MODEL_DISCOVERY_TIMEOUT
        } else {
            super::MODEL_DISCOVERY_TIMEOUT
        },
    )?;
    let combined = format!("{}\n{}", output.stdout, output.stderr);
    let marker = combined
        .find("Supported:")
        .map(|index| index + "Supported:".len())
        .or_else(|| {
            combined
                .find("Allowed choices are")
                .map(|index| index + "Allowed choices are".len())
        })
        .ok_or_else(|| format!("{program} did not expose choices for this control"))?;
    let choices = combined[marker..]
        .split(['.', '\n'])
        .next()
        .unwrap_or_default();
    Ok(choices
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| AgentChatModel {
            id: value.to_string(),
            label: value.to_string(),
            description: None,
        })
        .collect())
}

pub fn list_command_models(
    program: &str,
    args: &[&str],
    cwd: &Path,
) -> Result<Vec<AgentChatModel>, String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let child = command.spawn().map_err(|error| error.to_string())?;
    let output = read_child_output_with_timeout(
        child,
        if program == "cmd" {
            super::COMMAND_MODEL_DISCOVERY_TIMEOUT
        } else {
            super::MODEL_DISCOVERY_TIMEOUT
        },
    )?;
    if !output.status.success() && output.stdout.trim().is_empty() {
        return Err(if output.stderr.trim().is_empty() {
            format!("{program} model listing failed")
        } else {
            output.stderr.trim().to_string()
        });
    }
    Ok(parse_model_lines(&output.stdout))
}

struct ChildOutput {
    status: std::process::ExitStatus,
    stdout: String,
    stderr: String,
}

fn read_child_output_with_timeout(
    mut child: std::process::Child,
    timeout: Duration,
) -> Result<ChildOutput, String> {
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "model discovery stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "model discovery stderr unavailable".to_string())?;
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut out = String::new();
        let mut err = String::new();
        let _ = BufReader::new(stdout).read_to_string(&mut out);
        let _ = BufReader::new(stderr).read_to_string(&mut err);
        let _ = tx.send((out, err));
    });
    let (stdout, stderr) = rx.recv_timeout(timeout).map_err(|_| {
        let _ = child.kill();
        "model discovery timed out".to_string()
    })?;
    let status = child.wait().map_err(|error| error.to_string())?;
    Ok(ChildOutput {
        status,
        stdout,
        stderr,
    })
}

pub fn parse_model_lines(output: &str) -> Vec<AgentChatModel> {
    output
        .lines()
        .filter_map(|raw| {
            let cleaned = strip_ansi(raw);
            let line = cleaned.trim();
            if line.is_empty() || line.starts_with("Available models") {
                return None;
            }
            let id = line.split_whitespace().next()?;
            if id.eq_ignore_ascii_case("models") || id.ends_with(':') || !looks_like_model_id(id) {
                return None;
            }
            let description = line
                .strip_prefix(id)
                .map(str::trim)
                .filter(|text| !text.is_empty())
                .map(str::to_string);
            Some(AgentChatModel {
                id: id.to_string(),
                label: id.to_string(),
                description,
            })
        })
        .collect()
}

fn looks_like_model_id(value: &str) -> bool {
    value.contains('/')
}

pub fn strip_ansi(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                let _ = chars.next();
                for next in chars.by_ref() {
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            } else {
                let _ = chars.next();
            }
        } else {
            output.push(ch);
        }
    }
    output
}
