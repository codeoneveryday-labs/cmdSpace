use super::agent_chat::{
    adapter::{build_launch, parse_structured_line, AdapterKind, AgentChatError},
    codex::CodexProtocol,
    claude::build_contextual_prompt,
    events::AgentChatEvent,
    AgentChatRuntime,
};
use std::path::Path;

#[test]
fn adapters_build_protocol_native_launches() {
    let cwd = Path::new("/tmp/project");

    let codex = build_launch("codex", cwd).unwrap();
    assert_eq!(codex.adapter, AdapterKind::CodexAppServer);
    assert_eq!(codex.program, "codex");
    assert_eq!(codex.args, ["app-server", "--stdio"]);
    assert_eq!(codex.cwd, cwd);

    let claude = build_launch("claude", cwd).unwrap();
    assert_eq!(claude.adapter, AdapterKind::ClaudeJson);
    assert_eq!(claude.program, "claude");
    assert_eq!(claude.args, ["--print", "--json"]);
    assert_eq!(claude.cwd, cwd);

    let omp = build_launch("omp", cwd).unwrap();
    assert_eq!(omp.adapter, AdapterKind::OmpRpc);
    assert_eq!(omp.program, "omp");
    assert_eq!(omp.args, ["--mode", "rpc"]);

    let gemini = build_launch("gemini", cwd).unwrap();
    assert_eq!(gemini.args, ["--skip-trust", "--yolo", "--output-format", "stream-json", "--prompt"]);
    let opencode = build_launch("opencode", cwd).unwrap();
    assert_eq!(opencode.args, ["run", "--format", "json", "--auto"]);
    let command_code = build_launch("cmd", cwd).unwrap();
    assert_eq!(command_code.args, ["-p", "--output-format", "json", "--yolo"]);
}

#[test]
fn codex_and_claude_output_normalize_to_shared_events() {
    let codex = parse_structured_line(
        AdapterKind::CodexAppServer,
        r#"{"method":"item/agentMessage/delta","params":{"delta":"hello"}}"#,
    );
    assert_eq!(codex, vec![AgentChatEvent::Assistant { text: "hello".into() }]);

    let claude = parse_structured_line(
        AdapterKind::ClaudeJson,
        r#"{"session_id":"claude-session","result":"done"}"#,
    );
    assert_eq!(
        claude,
        vec![
            AgentChatEvent::Session { native_id: "claude-session".into() },
            AgentChatEvent::Assistant { text: "done".into() },
        ]
    );
}

#[test]
fn omp_rpc_output_normalizes_to_shared_events() {
    let events = parse_structured_line(
        AdapterKind::OmpRpc,
        r#"{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}"#,
    );
    assert_eq!(events, vec![AgentChatEvent::Assistant { text: "hello".into() }]);
    assert_eq!(
        parse_structured_line(AdapterKind::OmpRpc, r#"{"type":"agent_end"}"#),
        vec![AgentChatEvent::Done]
    );
}

#[test]
fn print_adapters_normalize_headless_errors_and_nested_events() {
    assert_eq!(
        parse_structured_line(
            AdapterKind::GeminiStreamJson,
            r#"{"type":"result","error":{"message":"API key invalid"}}"#,
        ),
        vec![
            AgentChatEvent::Error { message: "API key invalid".into() },
            AgentChatEvent::Done,
        ]
    );
    assert_eq!(
        parse_structured_line(
            AdapterKind::OpenCodeJson,
            r#"{"type":"event","event":{"type":"text","part":{"text":"hello"}}}"#,
        ),
        vec![AgentChatEvent::Assistant { text: "hello".into() }]
    );
    assert_eq!(
        parse_structured_line(
            AdapterKind::OpenCodeJson,
            r#"{"type":"error","error":{"data":{"message":"provider key missing"}}}"#,
        ),
        vec![AgentChatEvent::Error { message: "provider key missing".into() }]
    );
    assert_eq!(
        parse_structured_line(
            AdapterKind::CommandCodeJson,
            r#"{"type":"result","subtype":"error","error":{"message":"not authenticated"},"finalText":""}"#,
        ),
        vec![
            AgentChatEvent::Error { message: "not authenticated".into() },
            AgentChatEvent::Done,
        ]
    );
}

#[test]
fn codex_tool_and_usage_output_normalize_to_shared_events() {
    let tool = parse_structured_line(
        AdapterKind::CodexAppServer,
        r#"{"method":"item/started","params":{"item":{"id":"call-1","type":"commandExecution","command":"pnpm test"}}}"#,
    );
    assert_eq!(
        tool,
        vec![AgentChatEvent::Tool {
            id: "call-1".into(),
            name: "pnpm test".into(),
            status: "running".into(),
            detail: None,
        }]
    );

    let usage = parse_structured_line(
        AdapterKind::CodexAppServer,
        r#"{"method":"thread/tokenUsage/updated","params":{"tokenUsage":{"total":{"inputTokens":12,"outputTokens":7}}}}"#,
    );
    assert_eq!(
        usage,
        vec![AgentChatEvent::Usage {
            input_tokens: 12,
            output_tokens: 7,
        }]
    );
}

#[test]
fn parser_ignores_unknown_json_and_reports_malformed_structured_output() {
    assert!(parse_structured_line(
        AdapterKind::CodexAppServer,
        r#"{"method":"unknown/event","params":{}}"#,
    )
    .is_empty());

    let malformed = parse_structured_line(AdapterKind::CodexAppServer, "{not-json}");
    assert!(matches!(
        malformed.as_slice(),
        [AgentChatEvent::Error { message }] if message.starts_with("invalid structured agent output:")
    ));
}

#[test]
fn normalized_events_serialize_for_the_frontend_contract() {
    assert_eq!(
        serde_json::to_value(AgentChatEvent::Session {
            native_id: "thread-1".into(),
        })
        .unwrap(),
        serde_json::json!({"type": "session", "nativeId": "thread-1"})
    );
    assert_eq!(
        serde_json::to_value(AgentChatEvent::Usage {
            input_tokens: 12,
            output_tokens: 7,
        })
        .unwrap(),
        serde_json::json!({"type": "usage", "inputTokens": 12, "outputTokens": 7})
    );
}

#[test]
fn unknown_provider_is_rejected() {
    assert_eq!(
        build_launch("aider", Path::new("/tmp/project")).unwrap_err(),
        AgentChatError::UnsupportedProvider("aider".into())
    );
}

#[test]
fn runtime_rejects_unknown_provider_with_typed_error() {
    let runtime = AgentChatRuntime::default();
    assert_eq!(
        runtime.validate_provider("aider"),
        Err(AgentChatError::UnsupportedProvider("aider".into()))
    );
}

#[test]
fn codex_protocol_reuses_thread_and_turn_identity() {
    let mut protocol = CodexProtocol::new("/tmp/project".into());
    let startup = protocol.startup_messages();
    assert_eq!(startup[0]["method"], "initialize");
    assert_eq!(startup[2]["method"], "thread/start");

    let events = protocol.handle_message(&serde_json::json!({
        "id": 2,
        "result": { "thread": { "id": "thread-1" } }
    }));
    assert_eq!(
        events,
        vec![AgentChatEvent::Session {
            native_id: "thread-1".into()
        }]
    );
    let first_turn = protocol.start_turn("first", Some("gpt-5.4")).unwrap();
    assert_eq!(first_turn["params"]["threadId"], "thread-1");
    assert_eq!(first_turn["params"]["model"], "gpt-5.4");
    assert_eq!(
        protocol.start_turn("overlap", None).unwrap_err(),
        "Codex turn is already active"
    );
    assert_eq!(protocol.cancel_turn().unwrap(), None);

    protocol.handle_message(&serde_json::json!({
        "method": "turn/started",
        "params": { "turn": { "id": "turn-1" } }
    }));
    let cancel = protocol.take_pending_interrupt().unwrap();
    assert_eq!(cancel["method"], "turn/interrupt");
    assert_eq!(cancel["params"]["threadId"], "thread-1");
    assert_eq!(cancel["params"]["turnId"], "turn-1");

    protocol.handle_message(&serde_json::json!({
        "method": "turn/completed",
        "params": { "turn": { "id": "turn-1", "status": "interrupted" } }
    }));
    let follow_up = protocol.start_turn("second", None).unwrap();
    assert_eq!(follow_up["params"]["threadId"], "thread-1");
}

#[test]
fn codex_protocol_resumes_persisted_thread() {
    let protocol = CodexProtocol::with_resume("/tmp/project".into(), "thread-existing".into());
    let startup = protocol.startup_messages();
    assert_eq!(startup[2]["method"], "thread/resume");
    assert_eq!(startup[2]["params"]["threadId"], "thread-existing");
}

#[test]
fn claude_follow_up_includes_prior_structured_turns() {
    let history = vec![
        ("user".to_string(), "inspect the repo".to_string()),
        ("assistant".to_string(), "I found the workspace module".to_string()),
    ];
    assert_eq!(
        build_contextual_prompt(&history, "add a test"),
        "Continue this coding-agent conversation in the same workspace.\n\nUser: inspect the repo\n\nAssistant: I found the workspace module\n\nUser: add a test"
    );
}
