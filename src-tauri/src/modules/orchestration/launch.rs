use serde::{Deserialize, Serialize};

/// How a worker's spawn request becomes an executable + argv, as pure
/// functions. Deliberately provider-agnostic: the frontend agent catalog
/// (`cliAgents.ts`) is the single source of truth for per-CLI launch lines
/// and unattended flags, so this module never carries a parallel provider
/// table. Callers pass the already-resolved `auto_flag` string; anything
/// provider-specific stays at worker start.

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerLaunch {
    /// The executable name alone — what the PTY layer resolves and spawns.
    pub bin: String,
    /// Everything else, in argv form, model flag included when applicable.
    pub args: Vec<String>,
    /// The full effective command line, for display and review surfaces.
    pub command: String,
}

/// Sanitize a string for use as an argv token. Rejects null bytes (truncation
/// attacks) and ASCII control characters except HT (0x09). The tokenizer and
/// PTY layer both treat argv as opaque strings passed to `execvp`/`CreateProcess`,
/// so shell metacharacters (`;`, `|`, `&&`, `$()`) are inert — but null bytes
/// would silently truncate and control characters could corrupt terminal output.
fn sanitize_argv_token(value: &str, label: &str) -> Result<(), String> {
    if value.contains('\0') {
        return Err(format!("{label} contains a null byte"));
    }
    if value.chars().any(|ch| ch.is_ascii_control() && ch != '\t') {
        return Err(format!("{label} contains a control character"));
    }
    Ok(())
}

/// Quote-aware command-line tokenizer: single/double quotes group words, a
/// backslash escapes the next character. Errors on unterminated quotes and on
/// lines with no tokens, so a malformed launch line fails loudly instead of
/// spawning the wrong binary.
pub fn split_command(command: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;
    let mut has_token = false;

    for character in command.chars() {
        if escaped {
            current.push(character);
            escaped = false;
            has_token = true;
            continue;
        }
        match character {
            '\\' if quote != Some('\'') => {
                escaped = true;
            }
            '\'' | '"' => {
                has_token = true;
                if Some(character) == quote {
                    quote = None;
                } else if quote.is_none() {
                    quote = Some(character);
                } else {
                    current.push(character);
                }
            }
            character if character.is_whitespace() && quote.is_none() => {
                if has_token {
                    tokens.push(std::mem::take(&mut current));
                    has_token = false;
                }
            }
            _ => {
                current.push(character);
                has_token = true;
            }
        }
    }
    if quote.is_some() {
        return Err("Unterminated quote in launch command".to_string());
    }
    if escaped {
        return Err("Dangling escape in launch command".to_string());
    }
    if has_token {
        tokens.push(current);
    }
    if tokens.is_empty() {
        return Err("Launch command has no executable".to_string());
    }
    Ok(tokens)
}

/// Token-exact stance check: the auto flag's leading token must already be
/// present as a whole argv token. Substring matching is wrong here — e.g. a
/// `-s` flag is a substring of many longer tokens but only a stance when it
/// stands alone.
pub fn has_flag_stance(args: &[String], auto_flag: &str) -> bool {
    let leading = split_command(auto_flag)
        .ok()
        .and_then(|tokens| tokens.into_iter().next());
    match leading {
        Some(first) => args.iter().any(|arg| arg == &first),
        None => false,
    }
}

pub fn with_model(args: Vec<String>, model: Option<&str>) -> Vec<String> {
    let Some(model) = model.map(str::trim).filter(|value| !value.is_empty()) else {
        return args;
    };
    if args.iter().any(|arg| arg == "--model") {
        return args;
    }
    // Model values come from user-edited manifests; reject null bytes and
    // control characters to prevent argv truncation or terminal injection.
    if model.contains('\0') || model.chars().any(|ch| ch.is_ascii_control() && ch != '\t') {
        return args;
    }
    let mut out = args;
    out.push("--model".to_string());
    out.push(model.to_string());
    out
}

pub struct WorkerLaunchRequest<'a> {
    /// Full command line authored by the caller (catalog launch line).
    pub request_command: Option<&'a str>,
    pub default_command: &'a str,
    /// Caller-resolved unattended flag (e.g. from the agent catalog).
    /// Empty means no auto stance: a headless worker with no human to click
    /// through permission prompts would stall at the first ask.
    pub auto_flag: Option<&'a str>,
    pub model: Option<&'a str>,
}

/// Build the spawn triple. Appends the auto flag only when the request takes
/// no stance of its own; splits the final line into one executable plus argv
/// (executing the whole line as the binary name fails with ENOENT while
/// reporting success upstream).
pub fn build_worker_launch(request: WorkerLaunchRequest<'_>) -> Result<WorkerLaunch, String> {
    let mut command = request
        .request_command
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(request.default_command)
        .trim()
        .to_string();
    if command.is_empty() {
        return Err("Launch command has no executable".to_string());
    }
    sanitize_argv_token(&command, "Launch command")?;
    let tokens = split_command(&command)?;
    if let Some(auto_flag) = request
        .auto_flag
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sanitize_argv_token(auto_flag, "Auto flag")?;
        if !has_flag_stance(&tokens[1..], auto_flag) {
            command.push(' ');
            command.push_str(auto_flag);
        }
    }
    let tokens = split_command(&command)?;
    let mut tokens = tokens.into_iter();
    let bin = tokens.next().unwrap_or_default();
    sanitize_argv_token(&bin, "Executable name")?;
    let args = with_model(tokens.collect(), request.model);
    for (index, arg) in args.iter().enumerate() {
        sanitize_argv_token(arg, &format!("Argument #{index}"))?;
    }
    Ok(WorkerLaunch { bin, args, command })
}

#[cfg(test)]
mod tests {
    use super::{
        build_worker_launch, has_flag_stance, split_command, with_model, WorkerLaunchRequest,
    };

    fn args(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| (*word).to_string()).collect()
    }

    #[test]
    fn tokenizer_groups_quotes_and_reports_bad_input() {
        assert_eq!(
            split_command("claude --model \"opus 4\" --flag").unwrap(),
            args(&["claude", "--model", "opus 4", "--flag"])
        );
        assert_eq!(
            split_command("cmd 'a b' c\\ d").unwrap(),
            args(&["cmd", "a b", "c d"])
        );
        assert!(split_command("").is_err());
        assert!(split_command("   ").is_err());
        assert!(split_command("claude \"oops").is_err());
        assert!(split_command("claude oops\\").is_err());
    }

    #[test]
    fn stance_detection_is_token_exact_not_substring() {
        assert!(has_flag_stance(
            &args(&["--dangerously-skip-permissions"]),
            "--dangerously-skip-permissions"
        ));
        assert!(!has_flag_stance(
            &args(&["--skip-permissions-extra"]),
            "--skip"
        ));
        assert!(!has_flag_stance(&args(&["-ss"]), "-s"));
        assert!(has_flag_stance(&args(&["-s", "other"]), "-s"));
        assert!(!has_flag_stance(&args(&["--model", "x"]), ""));
    }

    #[test]
    fn model_flag_is_injected_only_when_absent() {
        assert_eq!(
            with_model(args(&["codex"]), Some("gpt-5")),
            args(&["codex", "--model", "gpt-5"])
        );
        assert_eq!(
            with_model(args(&["codex", "--model", "o1"]), Some("gpt-5")),
            args(&["codex", "--model", "o1"])
        );
        assert_eq!(with_model(args(&["codex"]), None), args(&["codex"]));
        assert_eq!(with_model(args(&["codex"]), Some("  ")), args(&["codex"]));
    }

    #[test]
    fn build_appends_auto_flag_splits_bin_and_argv() {
        let launch = build_worker_launch(WorkerLaunchRequest {
            request_command: Some("codex"),
            default_command: "codex",
            auto_flag: Some("--dangerously-bypass-approvals-and-sandbox"),
            model: None,
        })
        .unwrap();
        assert_eq!(launch.bin, "codex");
        assert_eq!(
            launch.args,
            args(&["--dangerously-bypass-approvals-and-sandbox"])
        );
        assert_eq!(
            launch.command,
            "codex --dangerously-bypass-approvals-and-sandbox"
        );
    }

    #[test]
    fn build_keeps_an_explicit_stance_and_prefers_request_over_default() {
        let launch = build_worker_launch(WorkerLaunchRequest {
            request_command: Some("claude --dangerously-skip-permissions"),
            default_command: "codex",
            auto_flag: Some("--dangerously-skip-permissions"),
            model: Some("opus"),
        })
        .unwrap();
        assert_eq!(launch.bin, "claude");
        assert_eq!(
            launch.args,
            args(&["--dangerously-skip-permissions", "--model", "opus"])
        );
        assert_eq!(
            launch
                .command
                .matches("--dangerously-skip-permissions")
                .count(),
            1
        );
    }

    #[test]
    fn build_rejects_empty_commands() {
        let request = WorkerLaunchRequest {
            request_command: Some("   "),
            default_command: "",
            auto_flag: None,
            model: None,
        };
        assert!(build_worker_launch(request).is_err());
    }

    #[test]
    fn build_rejects_null_bytes_in_command() {
        let request = WorkerLaunchRequest {
            request_command: Some("codex --model opus\0--evil"),
            default_command: "codex",
            auto_flag: None,
            model: None,
        };
        assert!(build_worker_launch(request).is_err());
    }

    #[test]
    fn build_rejects_control_characters_in_command() {
        let request = WorkerLaunchRequest {
            request_command: Some("codex\x07--bell"),
            default_command: "codex",
            auto_flag: None,
            model: None,
        };
        assert!(build_worker_launch(request).is_err());
    }

    #[test]
    fn build_rejects_null_bytes_in_auto_flag() {
        let request = WorkerLaunchRequest {
            request_command: Some("codex"),
            default_command: "codex",
            auto_flag: Some("--safe\0--evil"),
            model: None,
        };
        assert!(build_worker_launch(request).is_err());
    }

    #[test]
    fn model_silently_drops_when_value_contains_null_or_control() {
        assert_eq!(
            with_model(args(&["codex"]), Some("opus\0--evil")),
            args(&["codex"])
        );
        assert_eq!(
            with_model(args(&["codex"]), Some("opus\x07bell")),
            args(&["codex"])
        );
        // Tab (0x09) is allowed — some model names could theoretically include it
        assert_eq!(
            with_model(args(&["codex"]), Some("opus\t4")),
            args(&["codex", "--model", "opus\t4"])
        );
    }
}
