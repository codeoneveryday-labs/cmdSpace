use cmdspace_mobile::{CmdSpaceMobileApp, MobileScreen};
use cmdspace_remote_client::RemoteClientAction;
use cmdspace_remote_protocol::{ClientMessage, ServerMessage};

#[test]
fn new_install_starts_on_the_pairing_screen() {
    let app = CmdSpaceMobileApp::new();

    assert_eq!(app.screen(), MobileScreen::PairDevice);
    assert_eq!(app.connection_status(), "Connect a desktop to begin");
}

#[test]
fn pairing_requires_a_websocket_endpoint_and_device_token() {
    let mut app = CmdSpaceMobileApp::new();

    assert!(app.begin_pairing("https://desktop.local", "token").is_err());
    assert!(app.begin_pairing("wss://desktop.local", "").is_err());
    assert_eq!(app.screen(), MobileScreen::PairDevice);
}

#[test]
fn pairing_normalizes_endpoint_and_reaches_remote_after_authentication() {
    let mut app = CmdSpaceMobileApp::new();

    app.begin_pairing("wss://desktop.local/", "device-token")
        .unwrap();
    assert_eq!(app.endpoint(), Some("wss://desktop.local/api/remote/ws"));
    assert_eq!(app.screen(), MobileScreen::Connecting);

    app.socket_opened();
    assert_eq!(
        app.handle_server_message(ServerMessage::Hello {
            authenticated: false,
            runtime_id: 1,
        }),
        vec![RemoteClientAction::Send(ClientMessage::Auth {
            token: "device-token".to_owned(),
        })]
    );
    assert_eq!(app.screen(), MobileScreen::Connecting);

    assert!(app
        .handle_server_message(ServerMessage::Authenticated)
        .is_empty());
    assert_eq!(app.screen(), MobileScreen::Remote);
    assert_eq!(app.connection_status(), "Connected");
}

#[test]
fn socket_loss_returns_an_active_remote_screen_to_connecting() {
    let mut app = CmdSpaceMobileApp::new();
    app.begin_pairing("ws://192.168.1.2", "device-token")
        .unwrap();
    app.socket_opened();
    app.handle_server_message(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    app.handle_server_message(ServerMessage::Authenticated);

    app.socket_lost();

    assert_eq!(app.screen(), MobileScreen::Connecting);
    assert_eq!(app.connection_status(), "Connect a desktop to begin");
}

#[test]
fn remote_screen_keeps_session_metadata_and_terminal_output() {
    let mut app = CmdSpaceMobileApp::new();
    app.begin_pairing("ws://192.168.1.2", "device-token")
        .unwrap();
    app.socket_opened();
    app.handle_server_message(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    app.handle_server_message(ServerMessage::Authenticated);

    app.handle_server_message(ServerMessage::Sessions {
        sessions: vec![cmdspace_remote_protocol::RemoteProtocolSession {
            id: 7,
            title: "Project terminal".to_owned(),
            cwd: Some("/project".to_owned()),
            workspace_id: None,
            agent: None,
            attached: true,
        }],
    });
    app.handle_server_message(ServerMessage::Output {
        session_id: 7,
        sequence: 1,
        data: "ready\\n".to_owned(),
    });

    assert_eq!(app.sessions()[0].title, "Project terminal");
    assert_eq!(app.terminal_text(7), Some("ready\\n"));
}

#[test]
fn remote_screen_delegates_terminal_intent_to_the_shared_client() {
    let mut app = CmdSpaceMobileApp::new();
    app.begin_pairing("ws://192.168.1.2", "device-token")
        .unwrap();
    app.socket_opened();
    app.handle_server_message(ServerMessage::Hello {
        authenticated: false,
        runtime_id: 1,
    });
    app.handle_server_message(ServerMessage::Authenticated);

    assert_eq!(
        app.select_session(Some(7)),
        vec![RemoteClientAction::Send(ClientMessage::Attach {
            session_id: 7,
            after: 0,
        })]
    );
    assert_eq!(
        app.send_input(7, "ls\\r".to_owned()),
        vec![RemoteClientAction::Send(ClientMessage::Input {
            session_id: 7,
            data: "ls\\r".to_owned(),
        })]
    );
    assert_eq!(
        app.resize(7, 80, 24),
        vec![RemoteClientAction::Send(ClientMessage::Resize {
            session_id: 7,
            cols: 80,
            rows: 24,
        })]
    );
}
