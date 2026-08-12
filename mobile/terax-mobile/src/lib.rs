//! Application state boundary for the native Terax remote app.
//!
//! The shared remote client handles protocol lifecycle. A future mobile UI
//! adapter will render this state and own the platform-specific transport.

use terax_remote_client::{ConnectionState, RemoteClient};

/// The native remote application's root state.
pub struct TeraxMobileApp {
    client: RemoteClient,
}

impl TeraxMobileApp {
    pub fn new() -> Self {
        Self {
            client: RemoteClient::new(""),
        }
    }

    pub fn connection_status(&self) -> &'static str {
        match self.client.state() {
            ConnectionState::Disconnected => "Connect a desktop to begin",
            ConnectionState::AwaitingHello => "Waiting for desktop handshake",
            ConnectionState::Authenticating => "Authenticating secure session",
            ConnectionState::Authenticated => "Connected",
        }
    }
}

impl Default for TeraxMobileApp {
    fn default() -> Self {
        Self::new()
    }
}
