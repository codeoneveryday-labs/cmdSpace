use cmdspace_remote_protocol::{
    ClientMessage, DeviceClientMessage, DeviceServerMessage, RemoteClientEnvelope,
    RemoteDeviceClientEnvelope, RemoteDeviceServerEnvelope, RemoteServerEnvelope, ServerMessage,
    Utf8StreamDecoder, REMOTE_DEVICE_PROTOCOL_VERSION, REMOTE_PROTOCOL_VERSION,
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
