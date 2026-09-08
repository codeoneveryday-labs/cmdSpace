//! Runtime facade for wake, breaker, event, and attachment coordination.

use serde_json::Value;
use tauri::ipc::Channel;

use super::model::{OrchestrationEvent, OrchestrationEventType};
use super::{breaker, hook_drain, mailbox, wake, OrchestrationRuntime};

impl OrchestrationRuntime {
    pub fn wake_note_spawn(&self, pty_id: &str, at: u64) -> Result<(), String> {
        self.wake
            .lock()
            .map_err(|_| "orchestration wake lock poisoned".to_string())?
            .note_spawn(pty_id, at);
        Ok(())
    }
    pub fn wake_note_hook(
        &self,
        agent_id: &str,
        event: Option<&str>,
        message: Option<&str>,
        at: u64,
    ) -> Result<(), String> {
        self.wake
            .lock()
            .map_err(|_| "orchestration wake lock poisoned".to_string())?
            .note_hook(agent_id, event, message, at);
        Ok(())
    }
    pub fn wake_forget(&self, agent_id: &str, pty_id: Option<&str>) -> Result<(), String> {
        self.wake
            .lock()
            .map_err(|_| "orchestration wake lock poisoned".to_string())?
            .forget(agent_id, pty_id);
        Ok(())
    }
    pub fn wake_decide(
        &self,
        run_id: &str,
        facts: Vec<wake::WakeFacts>,
        now: u64,
    ) -> Result<Vec<wake::WakeCandidate>, String> {
        self.snapshot(run_id)?;
        let ids = self
            .wake
            .lock()
            .map_err(|_| "orchestration wake lock poisoned".to_string())?
            .decide(&facts, now);
        Ok(ids
            .into_iter()
            .map(|agent_id| wake::WakeCandidate {
                agent_id,
                nudge: wake::WAKE_NUDGE.to_string(),
            })
            .collect())
    }
    pub fn handle_stop_hook(
        &self,
        event: &hook_drain::HookEvent,
    ) -> Result<hook_drain::DrainDecision, String> {
        let run = self.snapshot(&event.run_id)?;
        let is_orchestrator = event.agent_id == mailbox::ORCHESTRATOR_ID;
        if is_orchestrator || event.kind == hook_drain::HookKind::Notification {
            return Ok(hook_drain::decide(
                event,
                0,
                is_orchestrator,
                wake::WAKE_NUDGE,
            ));
        }
        let root = mailbox::mailbox_root(&run.id)?;
        let (unread, _) = mailbox::unread_ids(&root, &event.agent_id);
        Ok(hook_drain::decide(
            event,
            unread.len() as u32,
            false,
            wake::WAKE_NUDGE,
        ))
    }
    pub fn breaker_tick(
        &self,
        run_id: &str,
        input: breaker::BreakerInput,
    ) -> Result<breaker::BreakerDecision, String> {
        self.snapshot(run_id)?;
        let config = breaker::BreakerConfig::default();
        Ok(self
            .breaker
            .lock()
            .map_err(|_| "orchestration breaker lock poisoned".to_string())?
            .tick(&config, &input, super::now_ms()))
    }
    pub fn breaker_level(
        &self,
        run_id: &str,
        agent_id: &str,
    ) -> Result<breaker::BreakerLevel, String> {
        self.snapshot(run_id)?;
        Ok(self
            .breaker
            .lock()
            .map_err(|_| "orchestration breaker lock poisoned".to_string())?
            .level_for(agent_id))
    }
    pub fn record_event(
        &self,
        run_id: &str,
        task_id: Option<String>,
        event_type: OrchestrationEventType,
        payload: Value,
    ) -> Result<OrchestrationEvent, String> {
        self.snapshot(run_id)?;
        self.sink(run_id)?
            .record(run_id, task_id, event_type, payload)
    }
    pub fn attach(
        &self,
        run_id: &str,
        channel: Channel<OrchestrationEvent>,
    ) -> Result<String, String> {
        self.snapshot(run_id)?;
        self.sink(run_id)?.attach(channel)
    }
    pub fn detach(&self, run_id: &str, attachment_token: Option<&str>) -> Result<(), String> {
        self.sink(run_id)?.detach(attachment_token)
    }
}
