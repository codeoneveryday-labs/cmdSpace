use cmdspace_remote_protocol::{
    ClientMessage, DeviceClientMessage, DeviceServerMessage, RemoteClientEnvelope,
    RemoteDeviceClientEnvelope, RemoteDeviceServerEnvelope, RemoteProtocolWorkspace,
    RemoteRelayAdmission, RemoteRelayControlMessage, RemoteRelayRole, RemoteServerEnvelope,
    ServerMessage, Utf8StreamDecoder, REMOTE_DEVICE_PROTOCOL_VERSION, REMOTE_PROTOCOL_VERSION,
    REMOTE_RELAY_PROTOCOL_VERSION,
};

#[test]
fn versioned_input_uses_the_stable_camel_case_wire_shape() {
    let json = serde_json::to_value(RemoteClientEnvelope::new(ClientMessage::Input {
        session_id: 7,
        data: "ls\r".to_owned(),
    }))
    .unwrap();

    assert_eq!(json["version"], REMOTE_PROTOCOL_VERSION);
    assert_eq!(json["message"]["type"], "input");
    assert_eq!(json["message"]["sessionId"], 7);
    assert_eq!(json["message"]["data"], "ls\r");
}

#[test]
fn remote_peers_reject_an_unknown_protocol_version() {
    let error =
        serde_json::from_str::<RemoteClientEnvelope>(r#"{"version":1,"message":{"type":"ping"}}"#)
            .unwrap_err();

    assert!(error
        .to_string()
        .contains("unsupported remote protocol version"));
}

#[test]
fn terminal_output_and_split_utf8_remain_lossless() {
    let output = serde_json::to_value(RemoteServerEnvelope::new(ServerMessage::Output {
        session_id: 7,
        sequence: 12,
        data: "héllo".to_owned(),
    }))
    .unwrap();
    assert_eq!(output["message"]["type"], "output");
    assert_eq!(output["message"]["sessionId"], 7);

    let mut decoder = Utf8StreamDecoder::default();
    let bytes = "A🙂B".as_bytes();
    assert_eq!(decoder.push(&bytes[..3]), "A");
    assert_eq!(decoder.push(&bytes[3..]), "🙂B");
}

#[test]
fn device_pairing_uses_an_independent_v3_envelope() {
    let pairing = RemoteDeviceClientEnvelope::new(DeviceClientMessage::PairDevice {
        grant_secret: "one-time-qr-secret".to_owned(),
        device_name: "Boji iPhone".to_owned(),
        public_key: "base64-public-key".to_owned(),
        proof: "base64-signature".to_owned(),
    });

    let json = serde_json::to_value(pairing).unwrap();

    assert_eq!(json["version"], REMOTE_DEVICE_PROTOCOL_VERSION);
    assert_eq!(json["message"]["type"], "pairDevice");
    assert_eq!(json["message"]["grantSecret"], "one-time-qr-secret");
    assert_eq!(json["message"]["deviceName"], "Boji iPhone");
    assert_eq!(json["message"]["publicKey"], "base64-public-key");
    assert_eq!(json["message"]["proof"], "base64-signature");
}

#[test]
fn relay_admission_uses_a_separate_versioned_envelope() {
    let admission = RemoteRelayAdmission {
        version: REMOTE_RELAY_PROTOCOL_VERSION,
        role: RemoteRelayRole::Device,
        relay_id: "desktop-relay-01".to_owned(),
        credential: "one-time-admission-token".to_owned(),
    };

    let json = serde_json::to_value(admission).unwrap();

    assert_eq!(json["version"], REMOTE_RELAY_PROTOCOL_VERSION);
    assert_eq!(json["role"], "device");
    assert_eq!(json["relayId"], "desktop-relay-01");
    assert_eq!(json["credential"], "one-time-admission-token");
}

#[test]
fn relay_control_messages_keep_device_frames_multiplexed() {
    let value = RemoteRelayControlMessage::DeviceFrame {
        connection_id: "device-1".to_string(),
        payload: "{\"version\":3}".to_string(),
    };
    let json = serde_json::to_value(value).unwrap();
    assert_eq!(json["type"], "deviceFrame");
    assert_eq!(json["connectionId"], "device-1");
    assert_eq!(json["payload"], "{\"version\":3}");
}

#[test]
fn relay_heartbeat_uses_a_versioned_control_envelope() {
    let heartbeat = serde_json::to_value(RemoteRelayControlMessage::Heartbeat).unwrap();

    assert_eq!(heartbeat["type"], "heartbeat");
}

#[test]
fn device_protocol_reports_capability_and_ownership_errors_explicitly() {
    let denied = RemoteDeviceServerEnvelope::new(DeviceServerMessage::Error {
        code: "capability_denied".to_owned(),
        message: "device cannot write to this terminal".to_owned(),
        retryable: false,
    });
    let occupied = RemoteDeviceServerEnvelope::new(DeviceServerMessage::Error {
        code: "session_occupied".to_owned(),
        message: "terminal is controlled by another device".to_owned(),
        retryable: false,
    });

    assert_eq!(serde_json::to_value(denied).unwrap()["version"], 3);
    assert_eq!(
        serde_json::to_value(occupied).unwrap()["message"]["code"],
        "session_occupied"
    );
}

#[test]
fn device_protocol_carries_remote_commands_and_events_inside_v3() {
    let command = RemoteDeviceClientEnvelope::new(DeviceClientMessage::Command {
        command: ClientMessage::Input {
            session_id: 7,
            data: "pwd\r".to_owned(),
        },
    });
    let event = RemoteDeviceServerEnvelope::new(DeviceServerMessage::Event {
        event: ServerMessage::Output {
            session_id: 7,
            sequence: 3,
            data: "ready\n".to_owned(),
        },
    });

    assert_eq!(
        serde_json::to_value(command).unwrap()["message"]["type"],
        "command"
    );
    assert_eq!(
        serde_json::to_value(event).unwrap()["message"]["event"]["type"],
        "output"
    );
}

#[test]
fn device_protocol_acknowledges_terminal_attachment_before_input() {
    let event = RemoteDeviceServerEnvelope::new(DeviceServerMessage::Event {
        event: ServerMessage::Attached { session_id: 7 },
    });

    let json = serde_json::to_value(event).unwrap();
    assert_eq!(json["message"]["event"]["type"], "attached");
    assert_eq!(json["message"]["event"]["sessionId"], 7);
}

#[test]
fn device_protocol_carries_recent_standard_workspaces() {
    let command = RemoteDeviceClientEnvelope::new(DeviceClientMessage::Command {
        command: ClientMessage::ListWorkspaces,
    });
    let event = RemoteDeviceServerEnvelope::new(DeviceServerMessage::Event {
        event: ServerMessage::Workspaces {
            workspaces: vec![RemoteProtocolWorkspace {
                id: "zedra".to_owned(),
                name: "zedra".to_owned(),
                working_folder: "/Users/boji/projects/zedra".to_owned(),
            }],
        },
    });

    assert_eq!(
        serde_json::to_value(command).unwrap()["message"]["command"]["type"],
        "listWorkspaces"
    );
    assert_eq!(
        serde_json::to_value(event).unwrap()["message"]["event"]["workspaces"][0]["workingFolder"],
        "/Users/boji/projects/zedra"
    );
}

#[test]
fn device_protocol_creates_a_workspace_with_owned_terminals() {
    let command = RemoteDeviceClientEnvelope::new(DeviceClientMessage::Command {
        command: ClientMessage::CreateWorkspace {
            workspace_id: "workspace-mobile-1".to_owned(),
            name: "snake-game".to_owned(),
            working_folder: "/Users/boji/dev/app/snake-game".to_owned(),
            terminal_count: 2,
        },
    });

    let json = serde_json::to_value(command).unwrap();
    assert_eq!(json["message"]["command"]["type"], "createWorkspace");
    assert_eq!(
        json["message"]["command"]["workspaceId"],
        "workspace-mobile-1"
    );
    assert_eq!(json["message"]["command"]["terminalCount"], 2);
}
