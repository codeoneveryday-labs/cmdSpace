use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use super::providers::{self, ControlDiscovery, ModelDiscovery};
use serde::Serialize;
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::Duration,
};

const MODEL_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(5);
const COMMAND_MODEL_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatModel {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
}

pub fn list_models(provider: &str, cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let profile = providers::profile(provider)
        .ok_or_else(|| format!("model discovery is not supported for agent '{provider}'"))?;
    let models = match profile.model_discovery {
        ModelDiscovery::CodexAppServer => list_codex_models(cwd)?,
        ModelDiscovery::Command(args) => list_command_models(profile.program, args, cwd)?,
        ModelDiscovery::InteractiveSlash { command, args } => list_slash_models(profile.program, cwd, command, args)?,
    };
    Ok(dedupe(models))
}

pub fn list_slash_options(provider: &str, cwd: &Path, command: &str) -> Result<Vec<AgentChatModel>, String> {
    let profile = providers::profile(provider)
        .ok_or_else(|| format!("control discovery is not supported for agent '{provider}'"))?;
    if profile.control_discovery == ControlDiscovery::Codex {
        return match command {
            "/effort" => list_codex_effort_options(cwd),
            "/permissions" => list_codex_permission_options(cwd),
            "/mode" | "/plan" => list_codex_mode_options(cwd),
            _ => Ok(Vec::new()),
        };
    }
    if profile.control_discovery == ControlDiscovery::Cmd {
        let args: &[&str] = match command {
            "/effort" => &["--effort", "__discover_invalid__", "--no-session"],
            "/mode" | "/plan" => &["--permission-mode", "__discover_invalid__", "--no-session"],
            _ => &[],
        };
        if !args.is_empty() {
            let options = list_flag_choices(profile.program, args, cwd)?;
            return Ok(match command {
                "/plan" => options
                    .into_iter()
                    .filter(|option| option.id.eq_ignore_ascii_case("plan"))
                    .collect(),
                "/mode" => options
                    .into_iter()
                    .filter(|option| !option.id.eq_ignore_ascii_case("plan"))
                    .collect(),
                _ => options,
            });
        }
    }
    match profile.control_discovery {
        ControlDiscovery::InteractiveSlash { args } => {
            list_slash_models(profile.program, cwd, command, args).map(dedupe)
        }
        ControlDiscovery::Codex | ControlDiscovery::Cmd => Ok(Vec::new()),
    }
}

fn list_codex_permission_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "permissionProfile/list", false)?;
    Ok(dedupe(data.into_iter().filter_map(|profile| {
        let id = profile.get("id").and_then(Value::as_str)?;
        let allowed = profile.get("allowed").and_then(Value::as_bool).unwrap_or(true);
        if !allowed { return None; }
        Some(AgentChatModel {
            id: id.to_string(),
            label: id.to_string(),
            description: profile.get("description").and_then(Value::as_str).map(str::to_string),
        })
    }).collect()))
}

fn list_codex_effort_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "model/list", false)?;
    let mut options = Vec::new();
    for model in data {
        if let Some(efforts) = model.get("supportedReasoningEfforts").and_then(Value::as_array) {
            for effort in efforts {
                let Some(id) = effort.get("reasoningEffort").and_then(Value::as_str) else { continue; };
                options.push(AgentChatModel {
                    id: id.to_string(),
                    label: id.to_string(),
                    description: effort.get("description").and_then(Value::as_str).map(str::to_string),
                });
            }
        }
    }
    Ok(dedupe(options))
}

fn list_codex_mode_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "collaborationMode/list", true)?;
    Ok(dedupe(data.into_iter().filter_map(|mode| {
        let id = mode.get("mode").and_then(Value::as_str)?;
        Some(AgentChatModel {
            id: id.to_string(),
            label: mode.get("name").and_then(Value::as_str).unwrap_or(id).to_string(),
            description: mode.get("reasoning_effort").and_then(Value::as_str).map(str::to_string),
        })
    }).collect()))
}

fn list_codex_rpc_array(cwd: &Path, request_id: u64, method: &str, experimental: bool) -> Result<Vec<Value>, String> {
    let mut command = Command::new("codex");
    command.args(["app-server", "--stdio"]).current_dir(cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    crate::modules::proc::hide_console(&mut command);
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let mut writer = child.stdin.take().ok_or_else(|| "Codex controls stdin unavailable".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "Codex controls stdout unavailable".to_string())?;
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || { for line in BufReader::new(stdout).lines() { if tx.send(line).is_err() { break; } } });
    write_json_line(&mut writer, serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"cmdspace","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":experimental}}}))?;
    write_json_line(&mut writer, serde_json::json!({"method":"initialized","params":{}}))?;
    write_json_line(&mut writer, serde_json::json!({"id":request_id,"method":method,"params":{}}))?;
    let mut result = Vec::new();
    while let Ok(line) = rx.recv_timeout(MODEL_DISCOVERY_TIMEOUT) {
        let line = line.map_err(|error| error.to_string())?;
        let value: Value = match serde_json::from_str(&line) { Ok(value) => value, Err(_) => continue };
        if value.get("id").and_then(Value::as_u64) != Some(request_id) { continue; }
        if let Some(data) = value.pointer("/result/data").and_then(Value::as_array) { result = data.clone(); }
        break;
    }
    let _ = child.kill();
    Ok(result)
}

fn list_flag_choices(program: &str, args: &[&str], cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let mut command = Command::new(program);
    command.args(args).current_dir(cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let child = command.spawn().map_err(|error| error.to_string())?;
    let output = read_child_output_with_timeout(child, if program == "cmd" {
        COMMAND_MODEL_DISCOVERY_TIMEOUT
    } else {
        MODEL_DISCOVERY_TIMEOUT
    })?;
    let combined = format!("{}\n{}", output.stdout, output.stderr);
    let marker = combined.find("Supported:").map(|index| index + "Supported:".len())
        .or_else(|| combined.find("Allowed choices are").map(|index| index + "Allowed choices are".len()))
        .ok_or_else(|| format!("{program} did not expose choices for this control"))?;
    let choices = combined[marker..].split(['.', '\n']).next().unwrap_or_default();
    Ok(choices.split(',').map(str::trim).filter(|value| !value.is_empty()).map(|value| AgentChatModel { id: value.to_string(), label: value.to_string(), description: None }).collect())
}

fn dedupe(models: Vec<AgentChatModel>) -> Vec<AgentChatModel> {
    let mut seen = std::collections::HashSet::new();
    models
        .into_iter()
        .filter(|model| !model.id.trim().is_empty() && seen.insert(model.id.clone()))
        .collect()
}

fn list_command_models(
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
    let output = read_child_output_with_timeout(child, if program == "cmd" {
        COMMAND_MODEL_DISCOVERY_TIMEOUT
    } else {
        MODEL_DISCOVERY_TIMEOUT
    })?;
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

fn parse_model_lines(output: &str) -> Vec<AgentChatModel> {
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

fn strip_ansi(value: &str) -> String {
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

fn list_codex_models(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let mut command = Command::new("codex");
    command
        .args(["app-server", "--stdio"])
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    crate::modules::proc::hide_console(&mut command);
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let mut writer = child
        .stdin
        .take()
        .ok_or_else(|| "Codex model stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Codex model stdout unavailable".to_string())?;
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if tx.send(line).is_err() {
                break;
            }
        }
    });
    write_json_line(
        &mut writer,
        serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"cmdspace","version":env!("CARGO_PKG_VERSION")},"capabilities":{}}}),
    )?;
    write_json_line(
        &mut writer,
        serde_json::json!({"method":"initialized","params":{}}),
    )?;
    write_json_line(
        &mut writer,
        serde_json::json!({"id":3,"method":"model/list","params":{}}),
    )?;
    let mut result = Vec::new();
    while let Ok(line) = rx.recv_timeout(MODEL_DISCOVERY_TIMEOUT) {
        let line = line.map_err(|error| error.to_string())?;
        let value: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if value.get("id").and_then(Value::as_u64) != Some(3) {
            continue;
        }
        if let Some(models) = value
            .pointer("/result/data")
            .or_else(|| value.pointer("/result/models"))
            .and_then(Value::as_array)
        {
            for model in models {
                let Some(id) = model
                    .get("id")
                    .or_else(|| model.get("modelId"))
                    .and_then(Value::as_str)
                else {
                    continue;
                };
                result.push(AgentChatModel {
                    id: id.to_string(),
                    label: model
                        .get("displayName")
                        .or_else(|| model.get("name"))
                        .and_then(Value::as_str)
                        .unwrap_or(id)
                        .to_string(),
                    description: model
                        .get("description")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                });
            }
        }
        break;
    }
    let _ = child.kill();
    Ok(result)
}

fn write_json_line(writer: &mut impl Write, value: Value) -> Result<(), String> {
    serde_json::to_writer(&mut *writer, &value).map_err(|error| error.to_string())?;
    writer.write_all(b"\n").map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

fn list_slash_models(
    program: &str,
    cwd: &Path,
    slash_command: &str,
    args: &[&str],
) -> Result<Vec<AgentChatModel>, String> {
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 40,
            cols: 160,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;
    let mut command = CommandBuilder::new(program);
    command.cwd(cwd);
    for arg in args {
        command.arg(arg);
    }
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    drop(pair.slave);
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let killer = child.clone_killer();
    let slash_command = slash_command.to_string();
    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    if tx.send(buf[..size].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(700));
        let _ = writer.write_all(format!("{slash_command}\n").as_bytes());
        let _ = writer.flush();
        thread::sleep(Duration::from_millis(2200));
        let _ = writer.write_all(&[3]);
        let _ = writer.flush();
    });
    let mut output = Vec::new();
    while let Ok(chunk) = rx.recv_timeout(Duration::from_millis(500)) {
        output.extend_from_slice(&chunk);
        if output.len() > 512 * 1024 {
            break;
        }
    }
    let mut killer = killer;
    let _ = killer.kill();
    let _ = child.wait();
    let text = String::from_utf8_lossy(&output);
    Ok(parse_interactive_models(&text))
}

fn parse_interactive_models(output: &str) -> Vec<AgentChatModel> {
    let mut models = Vec::new();
    for raw in output.lines() {
        let line = strip_ansi(raw).trim().to_string();
        let candidate = line.trim_start_matches(['❯', '>', '•', '*']).trim();
        let lower = candidate.to_ascii_lowercase();
        if candidate.is_empty()
            || lower.contains("warning")
            || lower.contains("term is set")
            || lower.contains("continue anyway")
            || lower.contains("[y/n]")
            || lower.contains("press ")
            || lower.contains("error")
            || lower.contains("model")
            || candidate.contains(':')
        {
            continue;
        }
        if candidate.len() < 2 || candidate.len() > 160 || candidate.split_whitespace().count() > 6 {
            continue;
        }
        let id = candidate
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-")
            .to_ascii_lowercase();
        models.push(AgentChatModel {
            id,
            label: candidate.to_string(),
            description: None,
        });
    }
    models
}

#[cfg(test)]
mod tests {
    use super::{parse_interactive_models, parse_model_lines, strip_ansi};

    #[test]
    fn parses_opencode_and_command_model_lines() {
        let models =
            parse_model_lines("Available models · 2 models\nopenai/gpt-5.4  Fast\nclaude/sonnet");
        assert_eq!(
            models
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            ["openai/gpt-5.4", "claude/sonnet"]
        );
    }

    #[test]
    fn strips_terminal_escape_sequences() {
        assert_eq!(
            strip_ansi("\u{1b}[32mopenai/gpt-5.4\u{1b}[0m"),
            "openai/gpt-5.4"
        );
    }

    #[test]
    fn parses_slash_model_menu_labels() {
        let models = parse_interactive_models(
            "WARNING: TERM is set to dumb\nContinue anyway? [y/N]:\n❯ alpha-v1\n  beta v2\n  provider/gamma",
        );
        assert_eq!(
            models
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            ["alpha-v1", "beta-v2", "provider/gamma"]
        );
    }
}
