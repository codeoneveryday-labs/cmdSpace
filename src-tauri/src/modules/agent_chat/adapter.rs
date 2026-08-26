use super::events::AgentChatEvent;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AgentChatError {
    UnsupportedProvider(String),
}

impl std::fmt::Display for AgentChatError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedProvider(provider) => write!(
                formatter,
                "agent '{provider}' does not expose a structured chat transport"
            ),
        }
    }
}

impl std::error::Error for AgentChatError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdapterKind {
    CodexAppServer,
    ClaudeJson,
    OmpRpc,
    GeminiStreamJson,
    OpenCodeJson,
    CommandCodeJson,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LaunchSpec {
    pub adapter: AdapterKind,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

pub fn build_launch(provider: &str, cwd: &Path) -> Result<LaunchSpec, AgentChatError> {
    let (adapter, program, args) = match provider {
        "codex" => (
            AdapterKind::CodexAppServer,
            "codex",
            vec!["app-server", "--stdio"],
        ),
        "claude" => (
            AdapterKind::ClaudeJson,
            "claude",
            vec!["--print", "--json"],
        ),
        "omp" => (
            AdapterKind::OmpRpc,
            "omp",
            vec!["--mode", "rpc"],
        ),
        "gemini" => (
            AdapterKind::GeminiStreamJson,
            "gemini",
            vec!["--skip-trust", "--yolo", "--output-format", "stream-json", "--prompt"],
        ),
        "opencode" => (
            AdapterKind::OpenCodeJson,
            "opencode",
            vec!["run", "--format", "json", "--auto"],
        ),
        "cmd" => (
            AdapterKind::CommandCodeJson,
            "cmd",
            vec!["-p", "--output-format", "json", "--yolo"],
        ),
        _ => {
            return Err(AgentChatError::UnsupportedProvider(provider.to_string()));
        }
    };
    Ok(LaunchSpec {
        adapter,
        program: program.to_string(),
        args: args.into_iter().map(str::to_string).collect(),
        cwd: cwd.to_path_buf(),
    })
}

pub fn parse_structured_line(adapter: AdapterKind, line: &str) -> Vec<AgentChatEvent> {
    let input = line.trim();
    if input.is_empty() {
        return Vec::new();
    }
    let value = match serde_json::from_str::<Value>(input) {
        Ok(value) => value,
        Err(error) => {
            return vec![AgentChatEvent::Error {
                message: format!("invalid structured agent output: {error}"),
            }];
        }
    };
    match adapter {
        AdapterKind::CodexAppServer => parse_codex(&value),
        AdapterKind::ClaudeJson => parse_claude(&value),
        AdapterKind::OmpRpc => parse_omp(&value),
        AdapterKind::GeminiStreamJson => parse_gemini(&value),
        AdapterKind::OpenCodeJson => parse_opencode(&value),
        AdapterKind::CommandCodeJson => parse_command_code(&value),
    }
}

fn string_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    path.iter()
        .try_fold(value, |current, key| current.get(*key))?
        .as_str()
}

fn parse_codex(value: &Value) -> Vec<AgentChatEvent> {
    let method = value.get("method").and_then(Value::as_str).unwrap_or_default();
    match method {
        "thread/started" => string_at(value, &["params", "thread", "id"])
            .map(|native_id| AgentChatEvent::Session {
                native_id: native_id.to_string(),
            })
            .into_iter()
            .collect(),
        "item/agentMessage/delta" => text_delta(value, &["params", "delta"], false),
        "item/reasoning/textDelta" => text_delta(value, &["params", "delta"], true),
        "item/started" => parse_codex_tool(value, "running"),
        "item/completed" => parse_codex_tool(value, "completed"),
        "thread/tokenUsage/updated" => parse_codex_usage(value),
        "turn/completed" => vec![AgentChatEvent::Done],
        _ => Vec::new(),
    }
}

fn parse_codex_tool(value: &Value, status: &str) -> Vec<AgentChatEvent> {
    let item = value
        .get("params")
        .and_then(|params| params.get("item"))
        .unwrap_or(&Value::Null);
    if item.get("type").and_then(Value::as_str) != Some("commandExecution") {
        return Vec::new();
    }
    let Some(id) = item.get("id").and_then(Value::as_str) else {
        return Vec::new();
    };
    let name = item
        .get("command")
        .and_then(Value::as_str)
        .unwrap_or("Command");
    let detail = item
        .get("aggregatedOutput")
        .and_then(Value::as_str)
        .map(str::to_string);
    vec![AgentChatEvent::Tool {
        id: id.to_string(),
        name: name.to_string(),
        status: status.to_string(),
        detail,
    }]
}

fn parse_codex_usage(value: &Value) -> Vec<AgentChatEvent> {
    let Some(total) = value
        .get("params")
        .and_then(|params| params.get("tokenUsage"))
        .and_then(|usage| usage.get("total"))
    else {
        return Vec::new();
    };
    vec![AgentChatEvent::Usage {
        input_tokens: total
            .get("inputTokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: total
            .get("outputTokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
    }]
}

fn parse_claude(value: &Value) -> Vec<AgentChatEvent> {
    let mut events = Vec::new();
    if let Some(native_id) = value.get("session_id").and_then(Value::as_str) {
        events.push(AgentChatEvent::Session {
            native_id: native_id.to_string(),
        });
    }
    if let Some(text) = value.get("result").and_then(Value::as_str) {
        events.push(AgentChatEvent::Assistant {
            text: text.to_string(),
        });
    }
    events
}

fn parse_omp(value: &Value) -> Vec<AgentChatEvent> {
    match value.get("type").and_then(Value::as_str).unwrap_or_default() {
        "agent_start" | "turn_start" => vec![AgentChatEvent::Session {
            native_id: value
                .get("sessionId")
                .or_else(|| value.get("session_id"))
                .and_then(Value::as_str)
                .unwrap_or("omp-session")
                .to_string(),
        }],
        "agent_end" | "turn_end" => vec![AgentChatEvent::Done],
        "message_update" => {
            let event = value.get("assistantMessageEvent").unwrap_or(value);
            match event.get("type").and_then(Value::as_str) {
                Some("text_delta") => string_at(event, &["delta"])
                    .map(|text| AgentChatEvent::Assistant { text: text.to_string() })
                    .into_iter()
                    .collect(),
                Some("thinking_delta") => string_at(event, &["delta"])
                    .map(|text| AgentChatEvent::Reasoning { text: text.to_string() })
                    .into_iter()
                    .collect(),
                _ => Vec::new(),
            }
        }
        "tool_execution_start" => vec![AgentChatEvent::Tool {
            id: string_at(value, &["toolCallId"]).unwrap_or("omp-tool").to_string(),
            name: string_at(value, &["toolName"]).unwrap_or("Tool").to_string(),
            status: "running".to_string(),
            detail: None,
        }],
        "tool_execution_end" => vec![AgentChatEvent::Tool {
            id: string_at(value, &["toolCallId"]).unwrap_or("omp-tool").to_string(),
            name: string_at(value, &["toolName"]).unwrap_or("Tool").to_string(),
            status: "completed".to_string(),
            detail: value.get("result").and_then(Value::as_str).map(str::to_string),
        }],
        "response" if value.get("command").and_then(Value::as_str) == Some("prompt")
            && value.pointer("/data/agentInvoked") == Some(&Value::Bool(false)) => {
            vec![AgentChatEvent::Done]
        }
        _ => Vec::new(),
    }
}

fn parse_gemini(value: &Value) -> Vec<AgentChatEvent> {
    match value.get("type").and_then(Value::as_str).unwrap_or_default() {
        "init" => value.get("session_id").and_then(Value::as_str)
            .map(|id| vec![AgentChatEvent::Session { native_id: id.to_string() }]).unwrap_or_default(),
        "message" => {
            if value.get("role").and_then(Value::as_str) == Some("assistant") {
                value.get("content").and_then(Value::as_str)
                    .or_else(|| value.get("delta").and_then(Value::as_str))
                    .map(|text| vec![AgentChatEvent::Assistant { text: text.to_string() }]).unwrap_or_default()
            } else { Vec::new() }
        }
        "tool_use" => vec![AgentChatEvent::Tool {
            id: value.get("tool_call_id").or_else(|| value.get("id")).and_then(Value::as_str).unwrap_or("gemini-tool").to_string(),
            name: value.get("tool_name").and_then(Value::as_str).unwrap_or("Tool").to_string(),
            status: "running".to_string(), detail: None,
        }],
        "tool_result" => vec![AgentChatEvent::Tool {
            id: value.get("tool_call_id").or_else(|| value.get("id")).and_then(Value::as_str).unwrap_or("gemini-tool").to_string(),
            name: value.get("tool_name").and_then(Value::as_str).unwrap_or("Tool").to_string(),
            status: "completed".to_string(), detail: value.get("content").and_then(Value::as_str).map(str::to_string),
        }],
        "result" => {
            let mut events = Vec::new();
            if let Some(error) = value
                .get("error")
                .and_then(|error| error.get("message").or(Some(error)))
                .and_then(Value::as_str)
            {
                events.push(AgentChatEvent::Error { message: error.to_string() });
            }
            if let Some(response) = value.get("response").and_then(Value::as_str) {
                if !response.is_empty() {
                    events.push(AgentChatEvent::Assistant { text: response.to_string() });
                }
            }
            events.push(AgentChatEvent::Done);
            events
        }
        _ => Vec::new(),
    }
}

fn parse_opencode(value: &Value) -> Vec<AgentChatEvent> {
    let event = if value.get("type").and_then(Value::as_str) == Some("event") {
        value.get("event").unwrap_or(value)
    } else {
        value
    };
    let event_type = event.get("type").and_then(Value::as_str).unwrap_or_default();
    match event_type {
        "text" | "message" | "text_delta" | "message_update" => {
            let text = event.get("text")
                .or_else(|| event.get("delta"))
                .or_else(|| event.get("content"))
                .or_else(|| event.pointer("/part/text"))
                .or_else(|| event.pointer("/part/content"))
                .or_else(|| event.pointer("/message/text"))
                .and_then(Value::as_str);
            text.map(|text| vec![AgentChatEvent::Assistant { text: text.to_string() }]).unwrap_or_default()
        }
        "tool_use" | "tool-start" | "tool_start" | "tool_running" => vec![AgentChatEvent::Tool {
            id: event.get("id").or_else(|| event.get("toolCallId")).and_then(Value::as_str).unwrap_or("opencode-tool").to_string(),
            name: event.get("name").or_else(|| event.get("toolName")).and_then(Value::as_str).unwrap_or("Tool").to_string(),
            status: "running".to_string(),
            detail: None,
        }],
        "tool_result" | "tool-end" | "tool_end" | "tool_completed" => vec![AgentChatEvent::Tool {
            id: event.get("id").or_else(|| event.get("toolCallId")).and_then(Value::as_str).unwrap_or("opencode-tool").to_string(),
            name: event.get("name").or_else(|| event.get("toolName")).and_then(Value::as_str).unwrap_or("Tool").to_string(),
            status: "completed".to_string(),
            detail: event.get("output").or_else(|| event.get("content")).and_then(Value::as_str).map(str::to_string),
        }],
        "error" => vec![AgentChatEvent::Error {
            message: event.get("message")
                .and_then(Value::as_str)
                .or_else(|| event.pointer("/error/message").and_then(Value::as_str))
                .or_else(|| event.pointer("/error/data/message").and_then(Value::as_str))
                .or_else(|| event.get("error").and_then(Value::as_str))
                .unwrap_or("OpenCode failed")
                .to_string(),
        }],
        "step_finish" | "run_end" | "turn_end" | "result" | "session_end" => {
            let mut events = Vec::new();
            if let Some(error) = event.get("error").and_then(Value::as_str) {
                events.push(AgentChatEvent::Error { message: error.to_string() });
            }
            if let Some(text) = event.get("text").or_else(|| event.get("finalText")).and_then(Value::as_str) {
                if !text.is_empty() { events.push(AgentChatEvent::Assistant { text: text.to_string() }); }
            }
            events.push(AgentChatEvent::Done);
            events
        }
        _ => Vec::new(),
    }
}

fn parse_command_code(value: &Value) -> Vec<AgentChatEvent> {
    if value.get("type").and_then(Value::as_str) == Some("event") {
        let event = value.get("event").unwrap_or(&Value::Null);
        let event_type = event.get("type").and_then(Value::as_str).unwrap_or_default();
        if event_type.contains("tool") {
            return vec![AgentChatEvent::Tool { id: event.get("toolCallId").and_then(Value::as_str).unwrap_or("cmd-tool").to_string(), name: event.get("toolName").and_then(Value::as_str).unwrap_or("Tool").to_string(), status: if event_type.contains("running") { "running" } else { "completed" }.to_string(), detail: event.get("description").and_then(Value::as_str).map(str::to_string) }];
        }
        return Vec::new();
    }
    if value.get("type").and_then(Value::as_str) == Some("result") {
        let mut events = Vec::new();
        if let Some(id) = value.get("sessionId").and_then(Value::as_str) { events.push(AgentChatEvent::Session { native_id: id.to_string() }); }
        if let Some(text) = value.get("finalText").and_then(Value::as_str) {
            if !text.is_empty() {
                events.push(AgentChatEvent::Assistant { text: text.to_string() });
            }
        }
        if let Some(error) = value
            .get("error")
            .and_then(|error| error.get("message").or(Some(error)))
            .and_then(Value::as_str)
        {
            events.push(AgentChatEvent::Error { message: error.to_string() });
        }
        events.push(AgentChatEvent::Done);
        return events;
    }
    Vec::new()
}

fn text_delta(value: &Value, path: &[&str], reasoning: bool) -> Vec<AgentChatEvent> {
    string_at(value, path)
        .map(|text| {
            if reasoning {
                AgentChatEvent::Reasoning {
                    text: text.to_string(),
                }
            } else {
                AgentChatEvent::Assistant {
                    text: text.to_string(),
                }
            }
        })
        .into_iter()
        .collect()
}
