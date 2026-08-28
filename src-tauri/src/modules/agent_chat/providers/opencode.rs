use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};
use super::super::adapter::AdapterKind;

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::OpenCodeJson,
    program: "opencode",
    launch_args: &["run", "--format", "json", "--auto"],
    model_discovery: ModelDiscovery::Command(&["models"]),
    control_discovery: ControlDiscovery::InteractiveSlash { args: &[] },
};
