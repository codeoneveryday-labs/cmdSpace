use cmdspace_remote_client::{ConnectionState, RemoteClient, RemoteClientAction};
use cmdspace_remote_protocol::{ClientMessage, RemoteProtocolSession, ServerMessage};

fn session(id: u64) -> RemoteProtocolSession {
    RemoteProtocolSession {
        id,
        title: format!("Session {id}"),
        cwd: Some("/project".to_owned()),
        workspace_id: None,
        agent: None,
        attached: id == 7,
    }
}

#[test]
fn hello_authenticates_then_attaches_the_selected_session() {
    let mut client = RemoteClient::new("device-token");
    client.connection_opened();
    client.select_session(Some(7));

    assert_eq!(client.state(), ConnectionState::AwaitingHello);
    assert_eq!(
        client.handle(ServerMessage::Hello {
            authenticated: false,
            runtime_id: 1,
        }),
        vec![RemoteClientAction::Send(ClientMessage::Auth {
            token: "device-token".to_owned(),
        })]
    );
    assert_eq!(
        client.handle(ServerMessage::Authenticated),
        vec![RemoteClientAction::Send(ClientMessage::Attach {
            session_id: 7,
            after: 0,
        })]
    );
    assert_eq!(client.state(), ConnectionState::Authenticated);
}

#[test]
fn commands_wait_for_authentication_then_flush_in_order() {
    let mut client = RemoteClient::new("device-token");
    client.connection_opened();
    assert!(client.send_input(7, "pwd\r".to_owned()).is_empty());
    assert!(client.request_sessions().is_empty());

    client.handle(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    let actions = client.handle(ServerMessage::Authenticated);

    assert_eq!(
        actions,
        vec![
            RemoteClientAction::Send(ClientMessage::ListSessions),
            RemoteClientAction::Send(ClientMessage::Input {
                session_id: 7,
                data: "pwd\r".to_owned(),
            }),
        ]
    );
}

#[test]
fn output_is_deduplicated_and_runtime_restart_replays_from_zero() {
    let mut client = RemoteClient::new("device-token");
    client.connection_opened();
    client.select_session(Some(7));
    client.handle(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    client.handle(ServerMessage::Authenticated);

    assert_eq!(
        client.handle(ServerMessage::Output {
            session_id: 7,
            sequence: 3,
            data: "first".to_owned(),
        }),
        vec![RemoteClientAction::TerminalData {
            session_id: 7,
            sequence: 3,
            data: "first".to_owned(),
        }]
    );
    assert!(client
        .handle(ServerMessage::Output {
            session_id: 7,
            sequence: 3,
            data: "duplicate".to_owned(),
        })
        .is_empty());

    client.handle(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 2,
    });
    assert_eq!(
        client.handle(ServerMessage::Authenticated),
        vec![RemoteClientAction::Send(ClientMessage::Attach {
            session_id: 7,
            after: 0,
        })]
    );
}

#[test]
fn session_switch_detaches_the_previous_session_and_updates_metadata() {
    let mut client = RemoteClient::new("device-token");
    client.connection_opened();
    client.handle(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    client.handle(ServerMessage::Authenticated);

    assert_eq!(
        client.select_session(Some(7)),
        vec![RemoteClientAction::Send(ClientMessage::Attach {
            session_id: 7,
            after: 0,
        })]
    );
    assert_eq!(
        client.select_session(Some(8)),
        vec![
            RemoteClientAction::Send(ClientMessage::Detach { session_id: 7 }),
            RemoteClientAction::Send(ClientMessage::Attach {
                session_id: 8,
                after: 0,
            }),
        ]
    );
    assert_eq!(
        client.handle(ServerMessage::Sessions {
            sessions: vec![session(7), session(8)],
        }),
        vec![RemoteClientAction::SessionsChanged]
    );
    assert_eq!(client.sessions(), &[session(7), session(8)]);
}

#[test]
fn unauthenticated_errors_clear_the_connection_state() {
    let mut client = RemoteClient::new("device-token");
    client.connection_opened();
    client.handle(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });

    assert_eq!(
        client.handle(ServerMessage::Error {
            code: "unauthorized".to_owned(),
            message: "expired token".to_owned(),
            retryable: false,
        }),
        vec![RemoteClientAction::Unauthorized]
    );
    assert_eq!(client.state(), ConnectionState::AwaitingHello);
}
