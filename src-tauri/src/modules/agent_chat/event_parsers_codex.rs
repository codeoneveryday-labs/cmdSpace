use serde_json::Value;

use super::super::events::AgentChatEvent;

pub fn parse_codex(value: &Value) -> Vec<AgentChatEvent> {
    let method = value
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match method {
        "thread/started" => super::string_at(value, &["params", "thread", "id"])
            .map(|native_id| AgentChatEvent::Session {
                native_id: native_id.to_string(),
            })
            .into_iter()
            .collect(),
        "item/agentMessage/delta" => super::text_delta(value, &["params", "delta"], false),
        "item/reasoning/textDelta" => super::text_delta(value, &["params", "delta"], true),
        "item/started" => parse_codex_tool(value, "running"),
        "item/completed" => parse_codex_tool(value, "completed"),
        "thread/tokenUsage/updated" => parse_codex_usage(value),
        "turn/completed" | "task_complete" => {
            let mut events = Vec::new();
            if let Some(message) = value
                .pointer("/params/error/message")
                .or_else(|| value.pointer("/params/result/error/message"))
                .or_else(|| value.pointer("/error/message"))
                .or_else(|| value.pointer("/params/error"))
                .and_then(Value::as_str)
            {
                events.push(AgentChatEvent::Error {
                    message: message.to_string(),
                });
            }
            events.push(AgentChatEvent::Done);
            events
        }
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
