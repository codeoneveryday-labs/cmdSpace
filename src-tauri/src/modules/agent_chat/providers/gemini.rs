use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};
use super::super::adapter::AdapterKind;

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::GeminiStreamJson,
    program: "gemini",
    launch_args: &["--skip-trust", "--yolo", "--output-format", "stream-json", "--prompt"],
    model_discovery: ModelDiscovery::InteractiveSlash { command: "/model", args: &["--skip-trust"] },
    control_discovery: ControlDiscovery::InteractiveSlash { args: &["--skip-trust"] },
};
