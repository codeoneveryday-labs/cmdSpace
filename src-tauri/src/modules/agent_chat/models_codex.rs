use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;

use serde_json::Value;

use super::AgentChatModel;

pub fn list_codex_permission_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "permissionProfile/list", false)?;
    Ok(super::dedupe(
        data.into_iter()
            .filter_map(|profile| {
                let id = profile.get("id").and_then(Value::as_str)?;
                let allowed = profile
                    .get("allowed")
                    .and_then(Value::as_bool)
                    .unwrap_or(true);
                if !allowed {
                    return None;
                }
                Some(AgentChatModel {
                    id: id.to_string(),
                    label: id.to_string(),
                    description: profile
                        .get("description")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                })
            })
            .collect(),
    ))
}

pub fn list_codex_effort_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "model/list", false)?;
    let mut options = Vec::new();
    for model in data {
        if let Some(efforts) = model
            .get("supportedReasoningEfforts")
            .and_then(Value::as_array)
        {
            for effort in efforts {
                let Some(id) = effort.get("reasoningEffort").and_then(Value::as_str) else {
                    continue;
                };
                options.push(AgentChatModel {
                    id: id.to_string(),
                    label: id.to_string(),
                    description: effort
                        .get("description")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                });
            }
        }
    }
    Ok(super::dedupe(options))
}

pub fn list_codex_mode_options(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
    let data = list_codex_rpc_array(cwd, 4, "collaborationMode/list", true)?;
    Ok(super::dedupe(
        data.into_iter()
            .filter_map(|mode| {
                let id = mode.get("mode").and_then(Value::as_str)?;
                Some(AgentChatModel {
                    id: id.to_string(),
                    label: mode
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or(id)
                        .to_string(),
                    description: mode
                        .get("reasoning_effort")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                })
            })
            .collect(),
    ))
}

fn list_codex_rpc_array(
    cwd: &Path,
    request_id: u64,
    method: &str,
    experimental: bool,
) -> Result<Vec<Value>, String> {
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
        .ok_or_else(|| "Codex controls stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Codex controls stdout unavailable".to_string())?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if tx.send(line).is_err() {
                break;
            }
        }
    });
    write_json_line(
        &mut writer,
        serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"cmdspace","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":experimental}}}),
    )?;
    write_json_line(
        &mut writer,
        serde_json::json!({"method":"initialized","params":{}}),
    )?;
    write_json_line(
        &mut writer,
        serde_json::json!({"id":request_id,"method":method,"params":{}}),
    )?;
    let mut result = Vec::new();
    while let Ok(line) = rx.recv_timeout(super::MODEL_DISCOVERY_TIMEOUT) {
        let line = line.map_err(|error| error.to_string())?;
        let value: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if value.get("id").and_then(Value::as_u64) != Some(request_id) {
            continue;
        }
        if let Some(data) = value.pointer("/result/data").and_then(Value::as_array) {
            result = data.clone();
        }
        break;
    }
    let _ = child.kill();
    Ok(result)
}

pub fn list_codex_models(cwd: &Path) -> Result<Vec<AgentChatModel>, String> {
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
    std::thread::spawn(move || {
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
    while let Ok(line) = rx.recv_timeout(super::MODEL_DISCOVERY_TIMEOUT) {
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
