use super::super::adapter::AdapterKind;
use super::{ControlDiscovery, ModelDiscovery, ProviderProfile};

pub(crate) const PROFILE: ProviderProfile = ProviderProfile {
    adapter: AdapterKind::OmpRpc,
    program: "omp",
    launch_args: &["--mode", "rpc"],
    model_discovery: ModelDiscovery::InteractiveSlash {
        command: "/model",
        args: &["--mode", "interactive"],
    },
    control_discovery: ControlDiscovery::InteractiveSlash {
        args: &["--mode", "interactive"],
    },
};
