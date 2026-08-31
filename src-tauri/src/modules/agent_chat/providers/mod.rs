use super::adapter::AdapterKind;

pub(crate) mod claude;
pub(crate) mod cmd;
pub(crate) mod codex;
pub(crate) mod gemini;
pub(crate) mod omp;
pub(crate) mod opencode;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ModelDiscovery {
    CodexAppServer,
    Command(&'static [&'static str]),
    InteractiveSlash {
        command: &'static str,
        args: &'static [&'static str],
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ControlDiscovery {
    Codex,
    Cmd,
    InteractiveSlash { args: &'static [&'static str] },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ProviderProfile {
    pub adapter: AdapterKind,
    pub program: &'static str,
    pub launch_args: &'static [&'static str],
    pub model_discovery: ModelDiscovery,
    pub control_discovery: ControlDiscovery,
}

pub(crate) fn profile(provider: &str) -> Option<ProviderProfile> {
    match provider {
        "codex" => Some(codex::PROFILE),
        "claude" => Some(claude::PROFILE),
        "omp" => Some(omp::PROFILE),
        "gemini" => Some(gemini::PROFILE),
        "opencode" => Some(opencode::PROFILE),
        "cmd" => Some(cmd::PROFILE),
        _ => None,
    }
}
