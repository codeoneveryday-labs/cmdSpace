use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};
use super::super::adapter::AdapterKind;

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::ClaudeJson,
    program: "claude",
    launch_args: &["--print", "--output-format", "json"],
    model_discovery: ModelDiscovery::InteractiveSlash { command: "/model", args: &[] },
    control_discovery: ControlDiscovery::InteractiveSlash { args: &[] },
};
