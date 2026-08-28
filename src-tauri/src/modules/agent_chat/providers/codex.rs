use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};
use super::super::adapter::AdapterKind;

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::CodexAppServer,
    program: "codex",
    launch_args: &["app-server", "--stdio"],
    model_discovery: ModelDiscovery::CodexAppServer,
    control_discovery: ControlDiscovery::Codex,
};
