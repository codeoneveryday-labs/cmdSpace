use super::{events::AgentChatEvent, find_native_session_file};
use serde_json::Value;

pub(crate) fn load_native_history(
    provider: &str,
    native_session_id: &str,
) -> Result<Vec<AgentChatEvent>, String> {
    if provider != "codex" && provider != "claude" && provider != "cmd" {
        return Ok(Vec::new());
    }
    if native_session_id.len() > 100
        || !native_session_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Invalid native agent session id".to_string());
    }
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };
    let sessions_dir = match provider {
        "codex" => home.join(".codex").join("sessions"),
        "claude" => home.join(".claude").join("projects"),
        "cmd" => home.join(".commandcode").join("projects"),
        _ => return Ok(Vec::new()),
    };
    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }
    let Some(path) = find_native_session_file(&sessions_dir, native_session_id)? else {
        return Ok(Vec::new());
    };
    let contents = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(parse_native_history(provider, &contents))
}

pub(crate) fn parse_native_history(provider: &str, contents: &str) -> Vec<AgentChatEvent> {
    let mut events = Vec::new();
    for line in contents.lines() {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if provider == "codex" {
            let Some(payload) = value.get("payload") else {
                continue;
            };
            if value.get("type").and_then(Value::as_str) != Some("event_msg") {
                continue;
            }
            match payload.get("type").and_then(Value::as_str) {
                Some("user_message") => {
                    if let Some(text) = payload.get("message").and_then(Value::as_str) {
                        events.push(AgentChatEvent::User {
                            text: text.to_string(),
                        });
                    }
                }
                Some("agent_message")
                    if payload.get("phase").and_then(Value::as_str) == Some("final_answer") =>
                {
                    // Persisted Codex commentary is not user-facing chat history.
                    if let Some(text) = payload.get("message").and_then(Value::as_str) {
                        events.push(AgentChatEvent::Assistant {
                            text: text.to_string(),
                        });
                    }
                }
                _ => {}
            }
        } else if provider == "claude" {
            let role = value
                .pointer("/message/role")
                .or_else(|| value.pointer("/role"))
                .and_then(Value::as_str);
            let text = value
                .pointer("/message/content")
                .or_else(|| value.pointer("/content"))
                .and_then(|content| {
                    content.as_str().map(str::to_string).or_else(|| {
                        content.as_array().and_then(|parts| {
                            parts.iter().find_map(|part| {
                                part.get("text").and_then(Value::as_str).map(str::to_string)
                            })
                        })
                    })
                });
            if let Some(text) = text {
                match role {
                    Some("user") => events.push(AgentChatEvent::User { text }),
                    Some("assistant") => events.push(AgentChatEvent::Assistant { text }),
                    _ => {}
                }
            }
        } else if value.get("type").and_then(Value::as_str) == Some("message") {
            let role = value
                .get("message")
                .and_then(|message| message.get("role"))
                .and_then(Value::as_str);
            let text = value
                .get("message")
                .and_then(|message| message.get("content"))
                .and_then(Value::as_array)
                .and_then(|content| {
                    content
                        .iter()
                        .find_map(|item| item.get("text").and_then(Value::as_str))
                });
            if let Some(text) = text {
                if role == Some("user") {
                    events.push(AgentChatEvent::User {
                        text: text.to_string(),
                    });
                }
                if role == Some("assistant") {
                    events.push(AgentChatEvent::Assistant {
                        text: text.to_string(),
                    });
                }
            }
        }
    }
    events
}
