//! Live residency verification against the real provider CLIs.
//!
//! These tests drive the same `AgentChatRuntime` code paths the Tauri commands
//! use, but spawn actual `codex`/`claude` processes and run a real turn. They
//! are `#[ignore]`d so normal test runs and CI stay deterministic; execute
//! them explicitly with `cargo test -- --ignored` (or by test name).

use super::agent_chat::events::AgentChatEvent;
use super::agent_chat::{cancel_session, send_message, stop_session, AgentChatRuntime};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::ipc::{Channel, InvokeResponseBody};

type EventLog = Arc<Mutex<Vec<Value>>>;

fn collecting_channel(log: &EventLog) -> Channel<AgentChatEvent> {
    let sink = Arc::clone(log);
    Channel::new(move |body: InvokeResponseBody| {
        let value = match body {
            InvokeResponseBody::Json(payload) => serde_json::from_str::<Value>(&payload),
            InvokeResponseBody::Raw(bytes) => serde_json::from_slice::<Value>(&bytes),
        };
        if let Ok(value) = value {
            sink.lock().expect("event log poisoned").push(value);
        }
        Ok(())
    })
}

fn event_type(event: &Value) -> &str {
    event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
}

fn wait_for(
    log: &EventLog,
    from_index: usize,
    predicate: impl Fn(&Value) -> bool,
    timeout: Duration,
) -> Option<usize> {
    let deadline = Instant::now() + timeout;
    loop {
        {
            let log = log.lock().expect("event log poisoned");
            if let Some(offset) = log.iter().skip(from_index).position(&predicate) {
                return Some(from_index + offset);
            }
        }
        if Instant::now() >= deadline {
            return None;
        }
        thread::sleep(Duration::from_millis(200));
    }
}

fn error_messages_after(log: &EventLog, index: usize) -> Vec<String> {
    log.lock()
        .expect("event log poisoned")
        .iter()
        .skip(index)
        .filter(|event| event_type(event) == "error")
        .map(|event| {
            event
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string()
        })
        .collect()
}

#[test]
#[ignore = "drives the real codex CLI; run explicitly via cargo test -- --ignored"]
fn codex_steer_keeps_the_resident_runtime_alive() {
    let runtime = AgentChatRuntime::default();
    let log: EventLog = Arc::new(Mutex::new(Vec::new()));

    let started = runtime
        .start_codex(
            std::env::temp_dir(),
            "Write a detailed 500-word history of the Unix operating system.".to_string(),
            None,
            None,
            collecting_channel(&log),
        )
        .expect("codex cold start (is codex installed and authenticated?)");
    let session = runtime
        .session(&started.session_id)
        .expect("cold start registered the session");

    let activity = wait_for(
        &log,
        0,
        |event| matches!(event_type(event), "reasoning" | "assistant" | "tool"),
        Duration::from_secs(180),
    )
    .expect("codex turn produced activity before the interrupt");

    cancel_session(&session).expect("codex cancel accepted");

    let done = wait_for(
        &log,
        activity + 1,
        |event| event_type(event) == "done",
        Duration::from_secs(30),
    )
    .expect("post-interrupt Done arrives after codex cancel");
    let errors = error_messages_after(&log, activity + 1);
    assert!(
        errors.is_empty(),
        "a cancelled codex turn must not surface errors: {errors:?}"
    );

    assert!(runtime.session(&started.session_id).is_ok());
    let status = runtime.status().expect("runtime status");
    assert_eq!(
        status.resident_count, 1,
        "runtime must stay resident across the interrupt"
    );

    send_message(
        &runtime,
        &started.session_id,
        &session,
        "Now summarize that history in one sentence.".to_string(),
        None,
    )
    .expect("steered follow-up is accepted by the same runtime session");
    wait_for(
        &log,
        done + 1,
        |event| event_type(event) == "done",
        Duration::from_secs(180),
    )
    .expect("steered turn completes on the resident session");

    assert!(runtime.session(&started.session_id).is_ok());

    stop_session(&session).expect("teardown stop");
    runtime
        .forget_session(&started.session_id)
        .expect("teardown forget");
}

#[test]
#[ignore = "drives the real claude CLI; run explicitly via cargo test -- --ignored"]
fn claude_cancel_stops_the_turn_without_an_error_card_or_killing_residency() {
    let runtime = AgentChatRuntime::default();
    let log: EventLog = Arc::new(Mutex::new(Vec::new()));

    let started = runtime
        .start_claude(
            std::env::temp_dir(),
            "Count slowly from 1 to 40, one number per line, with a short remark for each."
                .to_string(),
            None,
            None,
            collecting_channel(&log),
        )
        .expect("claude cold start (is claude installed and authenticated?)");
    let session = runtime
        .session(&started.session_id)
        .expect("cold start registered the session");

    let activity = wait_for(
        &log,
        0,
        |event| matches!(event_type(event), "assistant" | "reasoning"),
        Duration::from_secs(180),
    )
    .expect("claude turn produced activity before the cancel");

    cancel_session(&session).expect("claude cancel accepted");

    let done = wait_for(
        &log,
        activity + 1,
        |event| event_type(event) == "done",
        Duration::from_secs(30),
    )
    .expect("post-kill Done arrives after claude cancel");
    let errors = error_messages_after(&log, activity + 1);
    assert!(
        errors.is_empty(),
        "a user cancel must not surface an error card: {errors:?}"
    );

    assert!(runtime.session(&started.session_id).is_ok());
    assert_eq!(
        runtime.status().expect("runtime status").resident_count,
        1,
        "runtime must stay resident across the cancel"
    );

    send_message(
        &runtime,
        &started.session_id,
        &session,
        "Continue from 41 to 45.".to_string(),
        None,
    )
    .expect("follow-up spawn accepted on the same session");
    wait_for(
        &log,
        done + 1,
        |event| event_type(event) == "done",
        Duration::from_secs(180),
    )
    .expect("follow-up turn completes on the resident session");

    assert!(runtime.session(&started.session_id).is_ok());

    stop_session(&session).expect("teardown stop");
    runtime
        .forget_session(&started.session_id)
        .expect("teardown forget");
}
