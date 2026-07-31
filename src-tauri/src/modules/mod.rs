pub mod agent_usage;
pub mod db;
pub mod fs;
pub mod git;
pub mod net;
pub mod proc;
pub mod pty;
pub mod remote;
pub mod remote_auth;
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "The wire contract is introduced in phase 1 and consumed by the WebSocket gateway in phase 2"
    )
)]
pub mod remote_protocol;
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
mod agent_usage_test;
