use serde_json::Value;

use super::super::events::AgentChatEvent;

pub fn parse_gemini(value: &Value) -> Vec<AgentChatEvent> {
    match value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "init" => value
            .get("session_id")
            .and_then(Value::as_str)
            .map(|id| {
                vec![AgentChatEvent::Session {
                    native_id: id.to_string(),
                }]
            })
            .unwrap_or_default(),
        "message" => {
            if value.get("role").and_then(Value::as_str) == Some("assistant") {
                value
                    .get("content")
                    .and_then(Value::as_str)
                    .or_else(|| value.get("delta").and_then(Value::as_str))
                    .map(|text| {
                        vec![AgentChatEvent::Assistant {
                            text: text.to_string(),
                        }]
                    })
                    .unwrap_or_default()
            } else {
                Vec::new()
            }
        }
        "tool_use" => vec![AgentChatEvent::Tool {
            id: value
                .get("tool_call_id")
                .or_else(|| value.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("gemini-tool")
                .to_string(),
            name: value
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("Tool")
                .to_string(),
            status: "running".to_string(),
            detail: None,
        }],
        "tool_result" => vec![AgentChatEvent::Tool {
            id: value
                .get("tool_call_id")
                .or_else(|| value.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("gemini-tool")
                .to_string(),
            name: value
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("Tool")
                .to_string(),
            status: "completed".to_string(),
            detail: value
                .get("content")
                .and_then(Value::as_str)
                .map(str::to_string),
        }],
        "result" => {
            let mut events = Vec::new();
            if let Some(error) = value
                .get("error")
                .and_then(|error| error.get("message").or(Some(error)))
                .and_then(Value::as_str)
            {
                events.push(AgentChatEvent::Error {
                    message: error.to_string(),
                });
            }
            if let Some(response) = value.get("response").and_then(Value::as_str) {
                if !response.is_empty() {
                    events.push(AgentChatEvent::Assistant {
                        text: response.to_string(),
                    });
                }
            }
            events.push(AgentChatEvent::Done);
            events
        }
        _ => Vec::new(),
    }
}

pub fn parse_opencode(value: &Value) -> Vec<AgentChatEvent> {
    let event = if value.get("type").and_then(Value::as_str) == Some("event") {
        value.get("event").unwrap_or(value)
    } else {
        value
    };
    let event_type = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match event_type {
        "text" | "message" | "text_delta" | "message_update" => {
            let text = event
                .get("text")
                .or_else(|| event.get("delta"))
                .or_else(|| event.get("content"))
                .or_else(|| event.pointer("/part/text"))
                .or_else(|| event.pointer("/part/content"))
                .or_else(|| event.pointer("/message/text"))
                .and_then(Value::as_str);
            text.map(|text| {
                vec![AgentChatEvent::Assistant {
                    text: text.to_string(),
                }]
            })
            .unwrap_or_default()
        }
        "tool_use" | "tool-start" | "tool_start" | "tool_running" => {
            vec![AgentChatEvent::Tool {
                id: event
                    .get("id")
                    .or_else(|| event.get("toolCallId"))
                    .and_then(Value::as_str)
                    .unwrap_or("opencode-tool")
                    .to_string(),
                name: event
                    .get("name")
                    .or_else(|| event.get("toolName"))
                    .and_then(Value::as_str)
                    .unwrap_or("Tool")
                    .to_string(),
                status: "running".to_string(),
                detail: None,
            }]
        }
        "tool_result" | "tool-end" | "tool_end" | "tool_completed" => {
            vec![AgentChatEvent::Tool {
                id: event
                    .get("id")
                    .or_else(|| event.get("toolCallId"))
                    .and_then(Value::as_str)
                    .unwrap_or("opencode-tool")
                    .to_string(),
                name: event
                    .get("name")
                    .or_else(|| event.get("toolName"))
                    .and_then(Value::as_str)
                    .unwrap_or("Tool")
                    .to_string(),
                status: "completed".to_string(),
                detail: event
                    .get("output")
                    .or_else(|| event.get("content"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
            }]
        }
        "error" => vec![AgentChatEvent::Error {
            message: event
                .get("message")
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
                events.push(AgentChatEvent::Error {
                    message: error.to_string(),
                });
            }
            if let Some(text) = event
                .get("text")
                .or_else(|| event.get("finalText"))
                .and_then(Value::as_str)
            {
                if !text.is_empty() {
                    events.push(AgentChatEvent::Assistant {
                        text: text.to_string(),
                    });
                }
            }
            events.push(AgentChatEvent::Done);
            events
        }
        _ => Vec::new(),
    }
}

pub fn parse_command_code(value: &Value) -> Vec<AgentChatEvent> {
    if value.get("type").and_then(Value::as_str) == Some("event") {
        let event = value.get("event").unwrap_or(&Value::Null);
        let event_type = event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if event_type == "run_end" {
            let mut events = Vec::new();
            if let Some(message) = event
                .pointer("/result/error/message")
                .or_else(|| event.pointer("/result/error"))
                .and_then(Value::as_str)
            {
                events.push(AgentChatEvent::Error {
                    message: message.to_string(),
                });
            }
            events.push(AgentChatEvent::Done);
            return events;
        }
        if event_type.contains("tool") {
            return vec![AgentChatEvent::Tool {
                id: event
                    .get("toolCallId")
                    .and_then(Value::as_str)
                    .unwrap_or("cmd-tool")
                    .to_string(),
                name: event
                    .get("toolName")
                    .and_then(Value::as_str)
                    .unwrap_or("Tool")
                    .to_string(),
                status: if event_type.contains("running") {
                    "running"
                } else {
                    "completed"
                }
                .to_string(),
                detail: event
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
            }];
        }
        return Vec::new();
    }
    if value.get("type").and_then(Value::as_str) == Some("result") {
        let mut events = Vec::new();
        if let Some(text) = value.get("finalText").and_then(Value::as_str) {
            if !text.is_empty() {
                events.push(AgentChatEvent::Assistant {
                    text: text.to_string(),
                });
            }
        }
        if let Some(error) = value
            .get("error")
            .and_then(|error| error.get("message").or(Some(error)))
            .and_then(Value::as_str)
        {
            events.push(AgentChatEvent::Error {
                message: error.to_string(),
            });
        }
        return events;
    }
    Vec::new()
}
