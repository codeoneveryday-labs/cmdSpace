use terax_remote_protocol::{
    ClientMessage, RemoteClientEnvelope, RemoteServerEnvelope, ServerMessage, Utf8StreamDecoder,
    REMOTE_PROTOCOL_VERSION,
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
