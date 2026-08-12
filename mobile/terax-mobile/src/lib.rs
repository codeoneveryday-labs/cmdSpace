//! Application state boundary for the native Terax remote app.
//!
//! The shared remote client handles protocol lifecycle. A future mobile UI
//! adapter will render this state and own the platform-specific transport.

use terax_remote_client::{ConnectionState, RemoteClient, RemoteClientAction};
use terax_remote_protocol::ServerMessage;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MobileScreen {
    PairDevice,
    Connecting,
    Remote,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PairingError {
    MissingEndpoint,
    InvalidEndpoint,
    MissingToken,
}

/// The native remote application's root state.
pub struct TeraxMobileApp {
    client: Option<RemoteClient>,
    endpoint: Option<String>,
    screen: MobileScreen,
}

impl TeraxMobileApp {
    pub fn new() -> Self {
        Self {
            client: None,
            endpoint: None,
            screen: MobileScreen::PairDevice,
        }
    }

    pub fn screen(&self) -> MobileScreen {
        self.screen
    }

    pub fn endpoint(&self) -> Option<&str> {
        self.endpoint.as_deref()
    }

    pub fn begin_pairing(&mut self, endpoint: &str, token: &str) -> Result<(), PairingError> {
        let endpoint = normalize_endpoint(endpoint)?;
        if token.trim().is_empty() {
            return Err(PairingError::MissingToken);
        }

        self.client = Some(RemoteClient::new(token.trim()));
        self.endpoint = Some(endpoint);
        self.screen = MobileScreen::Connecting;
        Ok(())
    }

    pub fn socket_opened(&mut self) {
        if let Some(client) = self.client.as_mut() {
            client.connection_opened();
        }
    }

    pub fn socket_lost(&mut self) {
        if let Some(client) = self.client.as_mut() {
            client.connection_lost();
            self.screen = MobileScreen::Connecting;
        }
    }

    pub fn handle_server_message(&mut self, message: ServerMessage) -> Vec<RemoteClientAction> {
        let Some(client) = self.client.as_mut() else {
            return Vec::new();
        };
        let actions = client.handle(message);
        self.screen = match client.state() {
            ConnectionState::Authenticated => MobileScreen::Remote,
            _ => MobileScreen::Connecting,
        };
        actions
    }

    pub fn connection_status(&self) -> &'static str {
        match self.client.as_ref().map(RemoteClient::state) {
            None | Some(ConnectionState::Disconnected) => "Connect a desktop to begin",
            Some(ConnectionState::AwaitingHello) => "Waiting for desktop handshake",
            Some(ConnectionState::Authenticating) => "Authenticating secure session",
            Some(ConnectionState::Authenticated) => "Connected",
        }
    }
}

impl Default for TeraxMobileApp {
    fn default() -> Self {
        Self::new()
    }
}

fn normalize_endpoint(endpoint: &str) -> Result<String, PairingError> {
    let endpoint = endpoint.trim().trim_end_matches('/');
    if endpoint.is_empty() {
        return Err(PairingError::MissingEndpoint);
    }
    if !endpoint.starts_with("ws://") && !endpoint.starts_with("wss://") {
        return Err(PairingError::InvalidEndpoint);
    }

    Ok(format!("{endpoint}/api/remote/ws"))
}
