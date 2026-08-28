use super::agent_chat::{
    adapter::{build_launch, parse_structured_line, AdapterKind, AgentChatError},
    codex::CodexProtocol,
    claude::build_contextual_prompt,
    events::AgentChatEvent,
    find_resumable_session_file,
    parse_native_history,
    providers,
    AgentChatRuntime,
};
use std::path::Path;
use std::fs;

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
    assert_eq!(claude.args, ["--print", "--output-format", "json"]);
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
    assert_eq!(command_code.args, ["--output-format", "json", "--yolo"]);
    assert_eq!(
        providers::profile("cmd").unwrap().model_discovery,
        super::agent_chat::providers::ModelDiscovery::Command(&[
            "--no-session",
            "--skip-onboarding",
            "--list-models",
        ])
    );
}

#[test]
fn provider_profiles_cover_each_supported_agent_chat_provider() {
    for provider in ["codex", "claude", "omp", "gemini", "opencode", "cmd"] {
        let profile = providers::profile(provider).expect("provider profile");
        assert!(!profile.program.is_empty(), "{provider} program");
        assert!(!profile.launch_args.is_empty(), "{provider} launch args");
    }
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
fn claude_usage_error_is_not_rendered_as_an_assistant_reply() {
    let events = parse_structured_line(
        AdapterKind::ClaudeJson,
        r#"{"session_id":"claude-session","is_error":true,"result":"Credit balance is too low"}"#,
    );

    assert_eq!(
        events,
        vec![
            AgentChatEvent::Session { native_id: "claude-session".into() },
            AgentChatEvent::Error { message: "Credit balance is too low".into() },
        ],
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
        vec![AgentChatEvent::Error { message: "not authenticated".into() }]
    );
    assert_eq!(
        parse_structured_line(
            AdapterKind::CommandCodeJson,
            r#"{"type":"result","subtype":"success","sessionId":"cmd-session","finalText":"hello"}"#,
        ),
        vec![AgentChatEvent::Assistant { text: "hello".into() }]
    );
}

#[test]
fn command_code_history_replays_durable_transcript_messages() {
    let events = parse_native_history(
        "cmd",
        concat!(
            r#"{"type":"session","id":"cmd-session"}"#, "\n",
            r#"{"type":"message","message":{"role":"user","content":[{"text":"hello"}]}}"#, "\n",
            r#"{"type":"message","message":{"role":"assistant","content":[{"text":"hi"}]}}"#,
        ),
    );

    assert_eq!(
        events,
        vec![
            AgentChatEvent::User { text: "hello".into() },
            AgentChatEvent::Assistant { text: "hi".into() },
        ]
    );
}

#[test]
fn claude_history_replays_durable_transcript_messages() {
    let events = parse_native_history(
        "claude",
        concat!(
            r#"{"type":"user","message":{"role":"user","content":"hello"}}"#, "\n",
            r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}"#,
        ),
    );

    assert_eq!(
        events,
        vec![
            AgentChatEvent::User { text: "hello".into() },
            AgentChatEvent::Assistant { text: "hi".into() },
        ],
    );
}

#[test]
fn command_code_usage_limit_run_end_surfaces_the_cli_message() {
    let events = parse_structured_line(
        AdapterKind::CommandCodeJson,
        r#"{"type":"event","event":{"type":"run_end","result":{"error":{"message":"You've reached your 5-hour usage limit. Resets at 3:00 PM."}}}}"#,
    );

    assert_eq!(
        events,
        vec![
            AgentChatEvent::Error {
                message: "You've reached your 5-hour usage limit. Resets at 3:00 PM.".into(),
            },
            AgentChatEvent::Done,
        ],
    );
}

#[test]
fn command_code_exit_codes_have_user_visible_usage_fallbacks() {
    assert!(providers::cmd::headless_exit_message(Some(5))
        .is_some_and(|message| message.contains("rate limited")));
    assert!(providers::cmd::headless_exit_message(Some(10))
        .is_some_and(|message| message.contains("credits")));
    assert_eq!(providers::cmd::headless_exit_message(Some(1)), None);
}

#[test]
fn command_code_resume_requires_a_nonempty_primary_transcript() {
    let temp = tempfile::tempdir().unwrap();
    let session_id = "cmd-session";
    let transcript = temp.path().join(format!("{session_id}.jsonl"));
    let checkpoint = temp.path().join(format!("{session_id}.checkpoints.jsonl"));
    fs::write(&transcript, "").unwrap();
    fs::write(&checkpoint, "checkpoint").unwrap();

    assert_eq!(find_resumable_session_file(temp.path(), session_id), None);

    fs::write(&transcript, r#"{"type":"session"}"#).unwrap();
    assert_eq!(
        find_resumable_session_file(temp.path(), session_id),
        Some(transcript),
    );
}

#[test]
fn command_code_run_end_materializes_a_resumable_transcript() {
    let root = tempfile::tempdir().unwrap();
    let sessions = root.path().join("projects/workspace");
    fs::create_dir_all(&sessions).unwrap();
    let session_id = "cmd-session";
    fs::write(sessions.join(format!("{session_id}.jsonl")), "").unwrap();
    let run_end = r#"{"type":"event","event":{"type":"run_end","result":{"nextState":{"sessionId":"cmd-session","messages":[{"role":"user","content":[{"type":"text","text":"hello"}],"meta":{"source":"user","createdAt":1,"messageId":"user-message-id"}},{"role":"assistant","content":[{"type":"text","text":"hi"}],"meta":{"source":"model","createdAt":2,"messageId":"assistant-message-id"}}]}}}}"#;

    let committed = providers::cmd::materialize_headless_transcript_in(
        root.path(),
        Path::new("/workspace"),
        run_end,
    )
    .unwrap();

    assert_eq!(committed.as_deref(), Some(session_id));
    let transcript = fs::read_to_string(sessions.join(format!("{session_id}.jsonl"))).unwrap();
    let records = transcript
        .lines()
        .map(|line| serde_json::from_str::<serde_json::Value>(line).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(records[0]["type"], "session");
    assert_eq!(records[2]["parentId"], "user-mes");
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
fn codex_usage_limit_completion_surfaces_the_cli_message() {
    let events = parse_structured_line(
        AdapterKind::CodexAppServer,
        r#"{"method":"task_complete","params":{"error":{"message":"You've hit your usage limit. Try again at 8:18 PM.","codex_error_info":"usage_limit_exceeded"}}}"#,
    );

    assert_eq!(
        events,
        vec![
            AgentChatEvent::Error {
                message: "You've hit your usage limit. Try again at 8:18 PM.".into(),
            },
            AgentChatEvent::Done,
        ],
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
fn codex_protocol_accepts_flat_resume_thread_id() {
    let mut protocol = CodexProtocol::with_resume("/tmp/project".into(), "thread-existing".into());
    let events = protocol.handle_message(&serde_json::json!({
        "id": 2,
        "result": { "threadId": "thread-existing" }
    }));

    assert_eq!(
        events,
        vec![AgentChatEvent::Session {
            native_id: "thread-existing".into()
        }]
    );
}

#[test]
fn codex_protocol_accepts_resumed_thread_notification() {
    let mut protocol = CodexProtocol::with_resume("/tmp/project".into(), "thread-existing".into());
    let events = protocol.handle_message(&serde_json::json!({
        "method": "thread/resumed",
        "params": { "thread": { "id": "thread-existing" } }
    }));

    assert_eq!(
        events,
        vec![AgentChatEvent::Session { native_id: "thread-existing".into() }]
    );
}

#[test]
fn codex_protocol_surfaces_resume_errors_to_the_chat() {
    let mut protocol = CodexProtocol::with_resume("/tmp/project".into(), "thread-existing".into());
    let events = protocol.handle_message(&serde_json::json!({
        "id": 2,
        "error": { "message": "thread already has an active writer" }
    }));

    assert_eq!(
        events,
        vec![AgentChatEvent::Error {
            message: "thread already has an active writer".into()
        }]
    );
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
