//! Canvas orchestration facade. Domain state, runtime coordination, and native
//! command adapters remain split behind this module's stable exports.

pub(crate) mod breaker;
pub(crate) mod command_support;
pub mod commands;
mod event_sink;
pub(crate) mod hive_files;
pub(crate) mod hook_drain;
pub(crate) mod launch;
pub(crate) mod mailbox;
mod manifest;
pub(crate) mod memory;
mod model;
pub(crate) mod protocol;
pub(crate) mod router;
mod run_state;
mod run_state_contract_tests;
mod runtime;
mod runtime_contract_tests;
mod runtime_coordination;
mod runtime_coordination_contract_tests;
mod runtime_lifecycle;
mod runtime_tasks;
pub(crate) mod spawn_queue;
pub(crate) mod wake;
mod worktree;

#[allow(unused_imports)]
pub use model::{
    AgentSpec, OrchestrationEvent, OrchestrationEventType, OrchestrationManifest,
    OrchestrationProvider, OrchestrationRun, OrchestrationRunStatus, OrchestrationTaskStatus,
    OrchestratorSpec, TaskExecution, TaskSpec,
};
pub(crate) use runtime::now_ms;
pub use runtime::OrchestrationRuntime;
