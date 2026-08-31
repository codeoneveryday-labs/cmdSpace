use super::{adapter::AdapterKind, events::AgentChatEvent};
use serde_json::Value;

#[path = "event_parsers_external.rs"]
mod external;
pub(super) use external::{parse_command_code, parse_gemini, parse_opencode};
#[path = "event_parsers_codex.rs"]
mod codex;
pub(super) use codex::parse_codex;
#[path = "event_parsers_core.rs"]
mod core;
pub(super) use core::{parse_claude, parse_omp};

pub(crate) fn parse(adapter: AdapterKind, value: &Value) -> Vec<AgentChatEvent> {
    match adapter {
        AdapterKind::CodexAppServer => parse_codex(value),
        AdapterKind::ClaudeJson => parse_claude(value),
        AdapterKind::OmpRpc => parse_omp(value),
        AdapterKind::GeminiStreamJson => parse_gemini(value),
        AdapterKind::OpenCodeJson => parse_opencode(value),
        AdapterKind::CommandCodeJson => parse_command_code(value),
    }
}

fn string_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    path.iter()
        .try_fold(value, |current, key| current.get(*key))?
        .as_str()
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
