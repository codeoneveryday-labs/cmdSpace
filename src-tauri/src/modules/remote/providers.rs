use super::super::remote_protocol::{RemoteProtocolProvider, ServerMessage};
use super::{websocket::send_remote_websocket_message, RemoteResponse};
#[path = "provider_config.rs"]
mod config;
use serde::Serialize;
use std::net::TcpStream;
use tungstenite::WebSocket;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteProviderEntry {
    id: String,
    name: String,
    executable: String,
    description: String,
    install_url: Option<String>,
    configured: bool,
    enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteProvidersPayload {
    providers: Vec<RemoteProviderEntry>,
}

const REMOTE_CLI_AGENT_CATALOG: &[(&str, &str, &str, &str, Option<&str>)] = &[
    (
        "claude",
        "Claude Code",
        "claude",
        "Anthropic's agentic coding CLI for terminal workflows.",
        Some("https://docs.anthropic.com/en/docs/claude-code/setup"),
    ),
    (
        "codex",
        "Codex",
        "codex",
        "OpenAI's coding agent for local terminal development.",
        Some("https://developers.openai.com/codex/cli"),
    ),
    (
        "gemini",
        "Gemini CLI",
        "gemini",
        "Google's official open-source Gemini coding CLI.",
        Some("https://geminicli.com"),
    ),
    (
        "opencode",
        "OpenCode",
        "opencode",
        "Open-source coding agent built for the terminal.",
        Some("https://opencode.ai/docs"),
    ),
    (
        "copilot",
        "GitHub Copilot",
        "copilot",
        "GitHub Copilot's agentic command-line interface.",
        Some("https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"),
    ),
    (
        "cursor",
        "Cursor Agent",
        "cursor-agent",
        "Cursor's coding agent for terminal and automation workflows.",
        Some("https://docs.cursor.com/en/cli/overview"),
    ),
    (
        "aider",
        "Aider",
        "aider",
        "AI pair programming in your terminal with repository context.",
        Some("https://aider.chat/docs/install.html"),
    ),
    (
        "pi",
        "Pi Coding Agent",
        "pi",
        "Minimal, extensible terminal coding agent from the Pi project.",
        Some("https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent"),
    ),
    (
        "amp",
        "Amp CLI",
        "amp",
        "Sourcegraph's frontier coding agent for terminal development.",
        Some("https://ampcode.com/manual"),
    ),
    (
        "cline",
        "Cline CLI",
        "cline",
        "Autonomous coding agent CLI with file, shell, and browser tools.",
        Some("https://cline.bot/cli"),
    ),
    (
        "goose",
        "Goose",
        "goose",
        "Local, extensible open-source agent for engineering tasks.",
        Some("https://block.github.io/goose/docs/getting-started/installation/"),
    ),
    (
        "qwen",
        "Qwen Code",
        "qwen",
        "Alibaba's open-source Qwen coding assistant.",
        Some("https://qwenlm.github.io/qwen-code-docs/en/users/overview"),
    ),
    (
        "kimi",
        "Kimi Code",
        "kimi",
        "Moonshot AI's open-source terminal coding agent.",
        Some("https://github.com/MoonshotAI/kimi-code"),
    ),
    (
        "openhands",
        "OpenHands CLI",
        "openhands",
        "Open-source software development agent for local workflows.",
        Some("https://docs.openhands.dev/openhands/usage/run-openhands/local-setup"),
    ),
    (
        "kiro",
        "Kiro CLI",
        "kiro-cli",
        "Kiro's terminal coding agent with spec-driven workflows.",
        Some("https://kiro.dev/cli/"),
    ),
    (
        "grok",
        "Grok CLI",
        "grok",
        "xAI's Grok coding agent for terminal development.",
        Some("https://grok.com"),
    ),
    (
        "herdr",
        "Herdr",
        "herdr",
        "Persistent terminal workspace for running coding agents.",
        Some("https://herdr.dev/docs/install/"),
    ),
    (
        "cmd",
        "Command Code",
        "cmd",
        "Command Code agent running directly in the terminal.",
        Some("https://github.com/CommandCodeAI/command-code"),
    ),
    (
        "agoragentic",
        "Agoragentic",
        "agoragentic",
        "Marketplace for AI capabilities and agent services.",
        Some("https://agoragentic.com"),
    ),
    (
        "auggie",
        "Auggie CLI",
        "auggie",
        "Augment Code's context-aware software engineering agent.",
        Some("https://www.augmentcode.com/product/cli"),
    ),
    (
        "autohand",
        "Autohand Code",
        "autohand",
        "AI coding agent powered by Autohand AI.",
        Some("https://www.autohand.ai/cli/"),
    ),
    (
        "codebuddy",
        "Codebuddy Code",
        "codebuddy",
        "Tencent Cloud's intelligent coding assistant.",
        Some("https://www.codebuddy.cn/cli/"),
    ),
    (
        "codewhale",
        "CodeWhale",
        "codewhale",
        "Terminal coding agent for DeepSeek and open models.",
        Some("https://codewhale.net/"),
    ),
    (
        "cortex",
        "Cortex Code",
        "cortex",
        "Snowflake Cortex Code agent for software development.",
        Some("https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli"),
    ),
    (
        "corust",
        "Corust Agent",
        "corust",
        "Rust-focused co-building agent for terminal workflows.",
        Some("https://github.com/Corust-ai/corust-agent-release/releases"),
    ),
    (
        "crow",
        "crow-cli",
        "crow",
        "Minimal ACP-native coding agent for terminal development.",
        Some("https://crow-ai.dev/"),
    ),
    (
        "deepagents",
        "DeepAgents",
        "deepagents",
        "General-purpose coding agent powered by LangChain.",
        Some("https://docs.langchain.com/oss/javascript/deepagents/overview"),
    ),
    (
        "devin",
        "Devin CLI",
        "devin",
        "Devin's terminal coding agent via Agent Client Protocol.",
        Some("https://cli.devin.ai/docs"),
    ),
    (
        "dimcode",
        "DimCode",
        "dimcode",
        "Coding agent that puts leading models at your command.",
        Some("https://dimcode.dev/docs/acp.html"),
    ),
    (
        "dirac",
        "Dirac",
        "dirac",
        "Open-source coding agent optimized for fast parallel edits.",
        Some("https://dirac.run"),
    ),
    (
        "factory-droid",
        "Factory Droid",
        "droid",
        "Factory Droid software engineering agent.",
        Some("https://factory.ai/product/cli"),
    ),
    (
        "fast-agent",
        "fast-agent",
        "fast-agent",
        "Multi-provider framework for building and running agents.",
        Some("https://fast-agent.ai/acp/"),
    ),
    (
        "glm",
        "GLM Agent",
        "glm",
        "Zhipu GLM coding agent with streaming and tool calls.",
        Some("https://github.com/stefandevo/glm-acp-agent"),
    ),
    (
        "hermes",
        "Hermes",
        "hermes",
        "Nous Research self-improving AI agent.",
        Some("https://hermes-agent.nousresearch.com/"),
    ),
    (
        "junie",
        "Junie",
        "junie",
        "JetBrains AI coding agent for software projects.",
        Some("https://junie.jetbrains.com/docs/junie-cli-acp.html"),
    ),
    (
        "kilo",
        "Kilo",
        "kilo",
        "Open-source coding agent for terminal development.",
        Some("https://kilo.ai/docs/code-with-ai/platforms/cli"),
    ),
    (
        "minion",
        "Minion Code",
        "minion",
        "AI code assistant with rich development tools.",
        Some("https://github.com/femto/minion-code"),
    ),
    (
        "mistral-vibe",
        "Mistral Vibe",
        "vibe",
        "Mistral's open-source coding assistant.",
        Some("https://github.com/mistralai/mistral-vibe"),
    ),
    (
        "nova",
        "Nova",
        "nova",
        "Compass AI software engineering agent.",
        Some("https://www.compassap.ai/portfolio/nova.html"),
    ),
    (
        "poolside",
        "Poolside",
        "pool",
        "Poolside's coding agent for software development.",
        Some("https://docs.poolside.ai/cli/pool"),
    ),
    (
        "qoder",
        "Qoder CLI",
        "qoder",
        "AI coding assistant with agentic development capabilities.",
        Some("https://qoder.com"),
    ),
    (
        "sigit",
        "siGit Code",
        "sigit",
        "Local-first coding agent with optional on-device inference.",
        Some("https://github.com/getsigit/sigit"),
    ),
    (
        "stakpak",
        "Stakpak",
        "stakpak",
        "Open-source DevOps agent written in Rust.",
        Some("https://stakpak.dev/"),
    ),
    (
        "trae",
        "TRAE CLI",
        "traecli",
        "ByteDance TRAE coding agent with native ACP support.",
        Some("https://docs.trae.cn/cli_get-started-with-trae-cli"),
    ),
    (
        "vt-code",
        "VT Code",
        "vtcode",
        "Open-source coding agent with LLM-native code understanding.",
        Some("https://github.com/vinhnx/VTCode"),
    ),
];

pub(super) fn remote_providers_response() -> Result<RemoteResponse, String> {
    let providers = remote_provider_entries();
    let body = serde_json::to_vec(&RemoteProvidersPayload { providers })
        .map_err(|e| format!("remote providers serialization failed: {e}"))?;
    Ok(RemoteResponse {
        status: "200 OK",
        content_type: "application/json; charset=utf-8",
        body,
    })
}

fn remote_provider_entries() -> Vec<RemoteProviderEntry> {
    let (configured, disabled) = config::remote_configured_agent_ids();
    REMOTE_CLI_AGENT_CATALOG
        .iter()
        .map(
            |(id, name, executable, description, install_url)| RemoteProviderEntry {
                id: id.to_string(),
                name: name.to_string(),
                executable: executable.to_string(),
                description: description.to_string(),
                install_url: install_url.map(str::to_string),
                configured: configured.iter().any(|candidate| candidate == id),
                enabled: configured.iter().any(|candidate| candidate == id)
                    && !disabled.iter().any(|candidate| candidate == id),
            },
        )
        .collect()
}

pub(super) fn send_remote_providers(socket: &mut WebSocket<TcpStream>) -> Result<(), String> {
    let providers = remote_provider_entries()
        .into_iter()
        .map(|provider| RemoteProtocolProvider {
            id: provider.id,
            name: provider.name,
            executable: provider.executable,
            description: provider.description,
            install_url: provider.install_url,
            configured: provider.configured,
            enabled: provider.enabled,
        })
        .collect();
    send_remote_websocket_message(socket, ServerMessage::ProvidersSnapshot { providers })
}
