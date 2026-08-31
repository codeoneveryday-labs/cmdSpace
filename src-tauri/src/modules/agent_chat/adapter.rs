use super::event_parsers;
use super::events::AgentChatEvent;
use super::providers;
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
    let profile = providers::profile(provider)
        .ok_or_else(|| AgentChatError::UnsupportedProvider(provider.to_string()))?;
    Ok(LaunchSpec {
        adapter: profile.adapter,
        program: profile.program.to_string(),
        args: profile
            .launch_args
            .iter()
            .map(|arg| (*arg).to_string())
            .collect(),
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
    event_parsers::parse(adapter, &value)
}
