use serde_json::Value;

use super::super::events::AgentChatEvent;

pub fn parse_claude(value: &Value) -> Vec<AgentChatEvent> {
    let mut events = Vec::new();
    if let Some(native_id) = value.get("session_id").and_then(Value::as_str) {
        events.push(AgentChatEvent::Session {
            native_id: native_id.to_string(),
        });
    }
    if let Some(text) = value.get("result").and_then(Value::as_str) {
        events.push(
            if value.get("is_error").and_then(Value::as_bool) == Some(true) {
                AgentChatEvent::Error {
                    message: text.to_string(),
                }
            } else {
                AgentChatEvent::Assistant {
                    text: text.to_string(),
                }
            },
        );
    }
    events
}

pub fn parse_omp(value: &Value) -> Vec<AgentChatEvent> {
    match value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
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
                Some("text_delta") => super::string_at(event, &["delta"])
                    .map(|text| AgentChatEvent::Assistant {
                        text: text.to_string(),
                    })
                    .into_iter()
                    .collect(),
                Some("thinking_delta") => super::string_at(event, &["delta"])
                    .map(|text| AgentChatEvent::Reasoning {
                        text: text.to_string(),
                    })
                    .into_iter()
                    .collect(),
                _ => Vec::new(),
            }
        }
        "tool_execution_start" => vec![AgentChatEvent::Tool {
            id: super::string_at(value, &["toolCallId"])
                .unwrap_or("omp-tool")
                .to_string(),
            name: super::string_at(value, &["toolName"])
                .unwrap_or("Tool")
                .to_string(),
            status: "running".to_string(),
            detail: None,
        }],
        "tool_execution_end" => vec![AgentChatEvent::Tool {
            id: super::string_at(value, &["toolCallId"])
                .unwrap_or("omp-tool")
                .to_string(),
            name: super::string_at(value, &["toolName"])
                .unwrap_or("Tool")
                .to_string(),
            status: "completed".to_string(),
            detail: value
                .get("result")
                .and_then(Value::as_str)
                .map(str::to_string),
        }],
        "response"
            if value.get("command").and_then(Value::as_str) == Some("prompt")
                && value.pointer("/data/agentInvoked") == Some(&Value::Bool(false)) =>
        {
            vec![AgentChatEvent::Done]
        }
        _ => Vec::new(),
    }
}
