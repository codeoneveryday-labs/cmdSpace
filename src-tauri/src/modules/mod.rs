pub mod agent_usage;
pub mod agent_chat;
pub mod db;
pub mod fs;
pub mod git;
pub mod music;
pub mod net;
pub mod proc;
pub mod pty;
pub mod remote;
pub mod remote_auth;
pub mod remote_devices;
pub mod remote_protocol;
pub mod remote_relay;
pub mod remote_tunnel;
pub mod secrets;
pub mod shell;
pub mod speech;
pub mod workspace;

#[cfg(test)]
mod remote_protocol_test;

#[cfg(test)]
mod remote_auth_test;

#[cfg(test)]
mod remote_tunnel_test;

#[cfg(test)]
mod remote_relay_test;

#[cfg(test)]
mod agent_usage_test;

#[cfg(test)]
mod agent_chat_test;

#[cfg(test)]
mod remote_devices_test;
