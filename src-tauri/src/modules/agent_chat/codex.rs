use super::{adapter::parse_structured_line, events::AgentChatEvent};
use crate::modules::agent_chat::adapter::AdapterKind;
use serde_json::{json, Value};
use std::path::PathBuf;

pub struct CodexProtocol {
    cwd: PathBuf,
    thread_id: Option<String>,
    turn_id: Option<String>,
    next_request_id: u64,
    turn_state: TurnState,
    pending_cancel: bool,
    resume_thread_id: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TurnState {
    Idle,
    Starting,
    Running,
    Cancelling,
}

impl CodexProtocol {
    pub fn new(cwd: PathBuf) -> Self {
        Self {
            cwd,
            thread_id: None,
            turn_id: None,
            next_request_id: 3,
            turn_state: TurnState::Idle,
            pending_cancel: false,
            resume_thread_id: None,
        }
    }

    pub fn with_resume(cwd: PathBuf, thread_id: String) -> Self {
        let mut protocol = Self::new(cwd);
        protocol.resume_thread_id = Some(thread_id);
        protocol
    }

    pub fn startup_messages(&self) -> Vec<Value> {
        vec![
            json!({
                "id": 1,
                "method": "initialize",
                "params": {
                    "clientInfo": { "name": "cmdspace", "title": "cmdSpace", "version": env!("CARGO_PKG_VERSION") },
                    "capabilities": {}
                }
            }),
            json!({ "method": "initialized", "params": {} }),
            self.resume_thread_id.as_ref().map_or_else(
                || json!({
                    "id": 2,
                    "method": "thread/start",
                    "params": {
                        "cwd": self.cwd.to_string_lossy(),
                        "approvalPolicy": "on-request",
                        "sandbox": "workspace-write"
                    }
                }),
                |thread_id| json!({
                    "id": 2,
                    "method": "thread/resume",
                    "params": { "threadId": thread_id }
                }),
            ),
        ]
    }

    pub fn start_turn(&mut self, prompt: &str, model: Option<&str>) -> Result<Value, String> {
        if self.turn_state != TurnState::Idle {
            return Err("Codex turn is already active".to_string());
        }
        let thread_id = self
            .thread_id
            .as_deref()
            .ok_or_else(|| "Codex thread is not ready".to_string())?;
        let id = self.next_request_id;
        self.next_request_id += 1;
        self.turn_id = None;
        self.turn_state = TurnState::Starting;
        let mut params = json!({
            "threadId": thread_id,
            "cwd": self.cwd.to_string_lossy(),
            "input": [{ "type": "text", "text": prompt }]
        });
        if let Some(model) = model.filter(|model| !model.is_empty() && *model != "default") {
            params["model"] = json!(model);
        }
        Ok(json!({
            "id": id,
            "method": "turn/start",
            "params": params
        }))
    }

    pub fn cancel_turn(&mut self) -> Result<Option<Value>, String> {
        match self.turn_state {
            TurnState::Idle => Err("Codex turn is not running".to_string()),
            TurnState::Starting => {
                self.pending_cancel = true;
                Ok(None)
            }
            TurnState::Running => {
                self.turn_state = TurnState::Cancelling;
                self.interrupt_message().map(Some)
            }
            TurnState::Cancelling => Ok(None),
        }
    }

    pub fn take_pending_interrupt(&mut self) -> Option<Value> {
        if !self.pending_cancel || self.turn_id.is_none() {
            return None;
        }
        self.pending_cancel = false;
        self.turn_state = TurnState::Cancelling;
        self.interrupt_message().ok()
    }

    fn interrupt_message(&self) -> Result<Value, String> {
        let thread_id = self
            .thread_id
            .as_deref()
            .ok_or_else(|| "Codex thread is not ready".to_string())?;
        let turn_id = self
            .turn_id
            .as_deref()
            .ok_or_else(|| "Codex turn is not running".to_string())?;
        Ok(json!({ "method": "turn/interrupt", "params": { "threadId": thread_id, "turnId": turn_id } }))
    }

    pub fn handle_message(&mut self, value: &Value) -> Vec<AgentChatEvent> {
        if value.get("id").and_then(Value::as_u64) == Some(2) {
            if let Some(thread_id) = value
                .get("result")
                .and_then(|result| result.get("thread"))
                .and_then(|thread| thread.get("id"))
                .and_then(Value::as_str)
            {
                self.thread_id = Some(thread_id.to_string());
                return vec![AgentChatEvent::Session {
                    native_id: thread_id.to_string(),
                }];
            }
        }
        if value.get("method").and_then(Value::as_str) == Some("turn/started") {
            self.turn_id = value
                .get("params")
                .and_then(|params| params.get("turn"))
                .and_then(|turn| turn.get("id"))
                .and_then(Value::as_str)
                .map(str::to_string);
            self.turn_state = if self.pending_cancel {
                TurnState::Cancelling
            } else {
                TurnState::Running
            };
        }
        if value.get("method").and_then(Value::as_str) == Some("turn/completed") {
            self.turn_state = TurnState::Idle;
            self.turn_id = None;
            self.pending_cancel = false;
        }
        parse_structured_line(AdapterKind::CodexAppServer, &value.to_string())
    }

    pub fn thread_id(&self) -> Option<&str> {
        self.thread_id.as_deref()
    }
}
