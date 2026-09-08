//! Bounded event observer with replay and generation-safe attachment.

use std::collections::VecDeque;
use std::sync::Mutex;

use tauri::ipc::Channel;

use super::model::{OrchestrationEvent, OrchestrationEventType};
use super::now_ms;
use serde_json::Value;

const REPLAY_LIMIT: usize = 256;

#[derive(Default)]
struct State {
    next_sequence: u64,
    generation: u64,
    channel: Option<Channel<OrchestrationEvent>>,
    replay: VecDeque<OrchestrationEvent>,
}

#[derive(Default)]
pub(crate) struct EventSink {
    state: Mutex<State>,
}

impl EventSink {
    pub(crate) fn restore(&self, events: Vec<OrchestrationEvent>) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?;
        state.next_sequence = events.iter().map(|event| event.sequence).max().unwrap_or(0);
        state.replay = events
            .into_iter()
            .rev()
            .take(REPLAY_LIMIT)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        Ok(())
    }

    pub(crate) fn record(
        &self,
        run_id: &str,
        task_id: Option<String>,
        event_type: OrchestrationEventType,
        payload: Value,
    ) -> Result<OrchestrationEvent, String> {
        let (event, generation, channel) = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "orchestration event state lock poisoned".to_string())?;
            state.next_sequence = state.next_sequence.saturating_add(1);
            let event = OrchestrationEvent {
                sequence: state.next_sequence,
                run_id: run_id.to_string(),
                task_id,
                event_type,
                timestamp: now_ms(),
                payload,
            };
            state.replay.push_back(event.clone());
            while state.replay.len() > REPLAY_LIMIT {
                state.replay.pop_front();
            }
            (event, state.generation, state.channel.clone())
        };
        if let Some(channel) = channel {
            if channel.send(event.clone()).is_err() {
                self.clear_channel_if_current(generation);
            }
        }
        Ok(event)
    }

    pub(crate) fn attach(&self, channel: Channel<OrchestrationEvent>) -> Result<String, String> {
        let (generation, replay) = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "orchestration event state lock poisoned".to_string())?;
            state.generation = state.generation.wrapping_add(1);
            let generation = state.generation;
            state.channel = Some(channel);
            (generation, state.replay.iter().cloned().collect::<Vec<_>>())
        };
        self.deliver_replay(generation, replay)?;
        Ok(generation.to_string())
    }

    pub(crate) fn detach(&self, attachment_token: Option<&str>) -> Result<(), String> {
        let Some(token) = attachment_token else {
            return Ok(());
        };
        let Ok(generation) = token.parse::<u64>() else {
            return Ok(());
        };
        let mut state = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?;
        if state.generation == generation {
            state.generation = state.generation.wrapping_add(1);
            state.channel = None;
        }
        Ok(())
    }

    fn deliver_replay(
        &self,
        generation: u64,
        replay: Vec<OrchestrationEvent>,
    ) -> Result<(), String> {
        let channel = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?
            .channel
            .clone();
        let Some(channel) = channel else {
            return Ok(());
        };
        for event in replay {
            if channel.send(event).is_err() {
                self.clear_channel_if_current(generation);
                return Ok(());
            }
        }
        Ok(())
    }

    fn clear_channel_if_current(&self, generation: u64) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if state.generation == generation {
            state.channel = None;
        }
    }
}
