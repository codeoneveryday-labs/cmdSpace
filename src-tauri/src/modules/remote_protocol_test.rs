use super::remote_protocol::{
    ClientMessage, RemoteClientEnvelope, RemoteProtocolSession, ServerMessage, Utf8StreamDecoder,
    REMOTE_PROTOCOL_VERSION,
};

#[test]
fn client_input_envelope_serializes_with_versioned_camel_case_fields() {
    let envelope = RemoteClientEnvelope::new(ClientMessage::Input {
        session_id: 7,
        data: "ls\r".to_string(),
    });

    let json = serde_json::to_value(envelope).unwrap();

    assert_eq!(json["version"], REMOTE_PROTOCOL_VERSION);
    assert_eq!(json["message"]["type"], "input");
    assert_eq!(json["message"]["sessionId"], 7);
    assert_eq!(json["message"]["data"], "ls\r");
}

#[test]
fn server_output_round_trips_through_the_protocol_envelope() {
    let envelope = RemoteClientEnvelope::new(ClientMessage::Ping);
    let json = serde_json::to_string(&envelope).unwrap();
    let decoded: RemoteClientEnvelope = serde_json::from_str(&json).unwrap();

    assert_eq!(decoded, envelope);

    let output = serde_json::to_value(super::remote_protocol::RemoteServerEnvelope::new(
        ServerMessage::Output {
            session_id: 7,
            sequence: 12,
            data: "héllo".to_string(),
        },
    ))
    .unwrap();
    assert_eq!(output["message"]["type"], "output");
    assert_eq!(output["message"]["sessionId"], 7);
    assert_eq!(output["message"]["sequence"], 12);
    assert_eq!(output["message"]["data"], "héllo");
}

#[test]
fn server_hello_includes_the_runtime_identity() {
    let hello = serde_json::to_value(super::remote_protocol::RemoteServerEnvelope::new(
        ServerMessage::Hello {
            authenticated: false,
            runtime_id: 42,
        },
    ))
    .unwrap();

    assert_eq!(hello["message"]["type"], "hello");
    assert_eq!(hello["message"]["runtimeId"], 42);
}

#[test]
fn protocol_rejects_a_different_version() {
    let json = r#"{"version":1,"message":{"type":"ping"}}"#;

    let error = serde_json::from_str::<RemoteClientEnvelope>(json).unwrap_err();

    assert!(error
        .to_string()
        .contains("unsupported remote protocol version"));
}

#[test]
fn utf8_stream_decoder_preserves_multibyte_characters_split_across_chunks() {
    let mut decoder = Utf8StreamDecoder::default();
    let bytes = "A🙂B".as_bytes();

    assert_eq!(decoder.push(&bytes[..3]), "A");
    assert_eq!(decoder.push(&bytes[3..]), "🙂B");
}

#[test]
fn session_metadata_uses_stable_wire_shape() {
    let session = RemoteProtocolSession {
        id: 3,
        title: "Claude Code".to_string(),
        cwd: Some("/Users/test/project".to_string()),
        workspace_id: None,
        agent: Some("claude".to_string()),
        attached: true,
    };

    let json = serde_json::to_value(session).unwrap();

    assert_eq!(json["id"], 3);
    assert_eq!(json["title"], "Claude Code");
    assert_eq!(json["cwd"], "/Users/test/project");
    assert_eq!(json["agent"], "claude");
    assert_eq!(json["attached"], true);
}
