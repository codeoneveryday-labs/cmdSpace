use super::providers::{self, ControlDiscovery, ModelDiscovery};
use serde::Serialize;
use std::{path::Path, time::Duration};

#[path = "models_codex.rs"]
mod codex;
#[path = "models_command.rs"]
mod command;
pub(super) use codex::{
    list_codex_effort_options, list_codex_mode_options, list_codex_models,
    list_codex_permission_options,
};
#[cfg(test)]
pub(super) use command::parse_model_lines;
pub(super) use command::strip_ansi;
pub(super) use command::{list_command_models, list_flag_choices};
#[path = "models_interactive.rs"]
mod interactive;
pub(super) use interactive::list_slash_models;
#[cfg(test)]
pub(super) use interactive::parse_interactive_models;

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
        ModelDiscovery::InteractiveSlash { command, args } => {
            list_slash_models(profile.program, cwd, command, args)?
        }
    };
    Ok(dedupe(models))
}

pub fn list_slash_options(
    provider: &str,
    cwd: &Path,
    command: &str,
) -> Result<Vec<AgentChatModel>, String> {
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

fn dedupe(models: Vec<AgentChatModel>) -> Vec<AgentChatModel> {
    let mut seen = std::collections::HashSet::new();
    models
        .into_iter()
        .filter(|model| !model.id.trim().is_empty() && seen.insert(model.id.clone()))
        .collect()
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
