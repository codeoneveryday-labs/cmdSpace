//! Platform-neutral lifecycle controller for a cmdSpace remote client.
//!
//! A mobile adapter feeds decoded protocol messages into [`RemoteClient`] and
//! executes its returned actions. Networking, token persistence, terminal
//! emulation, and UI rendering remain platform concerns.

use std::collections::{BTreeMap, VecDeque};

use cmdspace_remote_protocol::{
    ClientMessage, RemoteProtocolSession, RemoteProtocolWorkspace, ServerMessage,
};

const MAX_PENDING_MESSAGES: usize = 256;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ConnectionState {
    #[default]
    Disconnected,
    AwaitingHello,
    Authenticating,
    Authenticated,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RemoteClientAction {
    Send(ClientMessage),
    SessionsChanged,
    WorkspacesChanged,
    TerminalData {
        session_id: u64,
        sequence: u64,
        data: String,
    },
    SessionExited {
        session_id: u64,
        code: Option<i32>,
    },
    RemoteError {
        code: String,
        message: String,
        retryable: bool,
    },
    Unauthorized,
}

/// State owned by a native remote screen, independent of its transport and UI.
#[derive(Debug)]
pub struct RemoteClient {
    token: String,
    state: ConnectionState,
    runtime_id: Option<u64>,
    active_session_id: Option<u64>,
    sessions: Vec<RemoteProtocolSession>,
    workspaces: Vec<RemoteProtocolWorkspace>,
    last_sequences: BTreeMap<u64, u64>,
    pending_messages: VecDeque<ClientMessage>,
    list_requested: bool,
}

impl RemoteClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
            state: ConnectionState::Disconnected,
            runtime_id: None,
            active_session_id: None,
            sessions: Vec::new(),
            workspaces: Vec::new(),
            last_sequences: BTreeMap::new(),
            pending_messages: VecDeque::new(),
            list_requested: false,
        }
    }

    pub fn state(&self) -> ConnectionState {
        self.state
    }

    pub fn sessions(&self) -> &[RemoteProtocolSession] {
        &self.sessions
    }

    pub fn workspaces(&self) -> &[RemoteProtocolWorkspace] {
        &self.workspaces
    }

    pub fn active_session_id(&self) -> Option<u64> {
        self.active_session_id
    }

    /// Call after the platform adapter has opened its single WebSocket.
    pub fn connection_opened(&mut self) {
        if self.state == ConnectionState::Disconnected {
            self.state = ConnectionState::AwaitingHello;
        }
    }

    /// Call after the platform adapter observes a WebSocket close.
    pub fn connection_lost(&mut self) {
        self.state = ConnectionState::Disconnected;
    }

    /// Select the only terminal attached to the mobile screen at a time.
    pub fn select_session(&mut self, session_id: Option<u64>) -> Vec<RemoteClientAction> {
        if self.active_session_id == session_id {
            return Vec::new();
        }

        let previous = std::mem::replace(&mut self.active_session_id, session_id);
        let mut actions = Vec::new();
        if self.state == ConnectionState::Authenticated {
            if let Some(previous) = previous {
                actions.push(RemoteClientAction::Send(ClientMessage::Detach {
                    session_id: previous,
                }));
            }
            actions.extend(self.attach_active_session());
        }
        actions
    }

    pub fn request_sessions(&mut self) -> Vec<RemoteClientAction> {
        self.list_requested = true;
        if self.state == ConnectionState::Authenticated {
            vec![RemoteClientAction::Send(ClientMessage::ListSessions)]
        } else {
            Vec::new()
        }
    }

    pub fn request_workspaces(&mut self) -> Vec<RemoteClientAction> {
        self.send_or_queue(ClientMessage::ListWorkspaces)
    }

    pub fn create_session(
        &mut self,
        cwd: Option<String>,
        workspace_id: Option<String>,
    ) -> Vec<RemoteClientAction> {
        self.send_or_queue(ClientMessage::CreateSession { cwd, workspace_id })
    }

    pub fn send_input(&mut self, session_id: u64, data: String) -> Vec<RemoteClientAction> {
        self.send_or_queue(ClientMessage::Input { session_id, data })
    }

    pub fn resize(&mut self, session_id: u64, cols: u16, rows: u16) -> Vec<RemoteClientAction> {
        self.send_or_queue(ClientMessage::Resize {
            session_id,
            cols,
            rows,
        })
    }

    pub fn close_session(&mut self, session_id: u64) -> Vec<RemoteClientAction> {
        self.send_or_queue(ClientMessage::Close { session_id })
    }

    /// Feed a decoded server message from the platform transport into the client.
    pub fn handle(&mut self, message: ServerMessage) -> Vec<RemoteClientAction> {
        match message {
            ServerMessage::Hello { runtime_id, .. } => self.handle_hello(runtime_id),
            ServerMessage::Authenticated => self.handle_authenticated(),
            ServerMessage::Sessions { sessions } => {
                self.sessions = sessions;
                vec![RemoteClientAction::SessionsChanged]
            }
            ServerMessage::Workspaces { workspaces } => {
                self.workspaces = workspaces;
                vec![RemoteClientAction::WorkspacesChanged]
            }
            ServerMessage::Attached { .. } => Vec::new(),
            ServerMessage::Snapshot {
                session_id,
                sequence,
                data,
            }
            | ServerMessage::Output {
                session_id,
                sequence,
                data,
            } => self.handle_terminal_data(session_id, sequence, data),
            ServerMessage::Exit { session_id, code } => {
                vec![RemoteClientAction::SessionExited { session_id, code }]
            }
            ServerMessage::Error {
                code,
                message,
                retryable,
            } => self.handle_error(code, message, retryable),
            ServerMessage::Pong => Vec::new(),
        }
    }

    fn handle_hello(&mut self, runtime_id: u64) -> Vec<RemoteClientAction> {
        if self.runtime_id.is_some_and(|current| current != runtime_id) {
            self.last_sequences.clear();
        }
        self.runtime_id = Some(runtime_id);
        self.state = ConnectionState::Authenticating;
        vec![RemoteClientAction::Send(ClientMessage::Auth {
            token: self.token.clone(),
        })]
    }

    fn handle_authenticated(&mut self) -> Vec<RemoteClientAction> {
        self.state = ConnectionState::Authenticated;
        let mut actions = self.attach_active_session();
        if self.list_requested {
            actions.push(RemoteClientAction::Send(ClientMessage::ListSessions));
        }
        actions.extend(
            std::mem::take(&mut self.pending_messages)
                .into_iter()
                .map(RemoteClientAction::Send),
        );
        actions
    }

    fn handle_terminal_data(
        &mut self,
        session_id: u64,
        sequence: u64,
        data: String,
    ) -> Vec<RemoteClientAction> {
        let last = self
            .last_sequences
            .get(&session_id)
            .copied()
            .unwrap_or_default();
        if sequence <= last {
            return Vec::new();
        }
        self.last_sequences.insert(session_id, sequence);
        vec![RemoteClientAction::TerminalData {
            session_id,
            sequence,
            data,
        }]
    }

    fn handle_error(
        &mut self,
        code: String,
        message: String,
        retryable: bool,
    ) -> Vec<RemoteClientAction> {
        if self.state != ConnectionState::Authenticated {
            self.state = ConnectionState::AwaitingHello;
            return vec![RemoteClientAction::Unauthorized];
        }
        vec![RemoteClientAction::RemoteError {
            code,
            message,
            retryable,
        }]
    }

    fn send_or_queue(&mut self, message: ClientMessage) -> Vec<RemoteClientAction> {
        if self.state == ConnectionState::Authenticated {
            return vec![RemoteClientAction::Send(message)];
        }
        if self.pending_messages.len() < MAX_PENDING_MESSAGES {
            self.pending_messages.push_back(message);
        }
        Vec::new()
    }

    fn attach_active_session(&self) -> Vec<RemoteClientAction> {
        self.active_session_id
            .map(|session_id| {
                vec![RemoteClientAction::Send(ClientMessage::Attach {
                    session_id,
                    after: self
                        .last_sequences
                        .get(&session_id)
                        .copied()
                        .unwrap_or_default(),
                })]
            })
            .unwrap_or_default()
    }
}
