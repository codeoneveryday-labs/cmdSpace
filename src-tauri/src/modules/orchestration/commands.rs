//! Native command facade for Canvas orchestration.
//!
//! Generated Tauri command wrappers stay in responsibility-specific modules;
//! `core` contains callable implementation code only.

pub mod attachment;
#[path = "commands_impl.rs"]
pub(crate) mod core;
pub mod hooks;
pub mod lifecycle;
pub mod mailbox;
pub mod tasks;
pub mod worker;
