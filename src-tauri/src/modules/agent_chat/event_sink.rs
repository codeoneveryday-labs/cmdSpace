use super::events::AgentChatEvent;
use std::{collections::VecDeque, sync::Mutex};
use tauri::ipc::Channel;

pub(crate) const REPLAY_EVENT_LIMIT: usize = 128;

struct AttachState {
    generation: u64,
    pending: VecDeque<AgentChatEvent>,
}

struct EventSinkState {
    channel: Option<Channel<AgentChatEvent>>,
    replay: VecDeque<AgentChatEvent>,
    generation: u64,
    attach: Option<AttachState>,
}

/// Owns the current UI channel and the bounded event tail used by reattaching
/// clients. Replay batches and any live events that arrive during replay are
/// delivered outside the state lock so callback re-entry cannot deadlock the
/// sink, while preserving replay-before-live ordering for the active channel.
pub(crate) struct AgentChatEventSink {
    state: Mutex<EventSinkState>,
}

impl AgentChatEventSink {
    pub(crate) fn new(channel: Channel<AgentChatEvent>) -> Self {
        Self {
            state: Mutex::new(EventSinkState {
                channel: Some(channel),
                replay: VecDeque::new(),
                generation: 0,
                attach: None,
            }),
        }
    }

    pub(crate) fn attach(&self, next_channel: Channel<AgentChatEvent>) -> Result<String, String> {
        let (generation, replay) = self.begin_attach(next_channel)?;
        self.finish_attach(generation, replay)?;
        Ok(generation.to_string())
    }

    pub(crate) fn attachment_token(&self) -> Result<String, String> {
        self.state
            .lock()
            .map(|state| state.generation.to_string())
            .map_err(|_| "agent chat state lock poisoned".to_string())
    }

    pub(crate) fn detach_if_current(&self, attachment_token: &str) -> Result<bool, String> {
        let Ok(generation) = attachment_token.parse::<u64>() else {
            return Ok(false);
        };
        let mut state = self
            .state
            .lock()
            .map_err(|_| "agent chat state lock poisoned".to_string())?;
        if state.generation != generation {
            return Ok(false);
        }
        state.generation = state.generation.wrapping_add(1);
        state.channel = None;
        state.attach = None;
        Ok(true)
    }

    pub(crate) fn send(&self, event: AgentChatEvent) {
        let deliver = {
            let Ok(mut state) = self.state.lock() else {
                return;
            };
            state.replay.push_back(event.clone());
            while state.replay.len() > REPLAY_EVENT_LIMIT {
                state.replay.pop_front();
            }
            if let Some(attach) = state.attach.as_mut() {
                attach.pending.push_back(event);
                None
            } else {
                Some((state.generation, state.channel.clone(), event))
            }
        };

        let Some((generation, Some(channel), event)) = deliver else {
            return;
        };
        if channel.send(event).is_err() {
            self.clear_channel_if_current(generation);
        }
    }

    pub(crate) fn replay_len(&self) -> usize {
        self.state
            .lock()
            .map(|state| state.replay.len())
            .unwrap_or(0)
    }

    fn deliver_batch(&self, generation: u64, events: Vec<AgentChatEvent>) -> Result<(), String> {
        if events.is_empty() {
            return Ok(());
        }
        let channel = {
            let state = self
                .state
                .lock()
                .map_err(|_| "agent chat state lock poisoned".to_string())?;
            if state.generation != generation {
                return Ok(());
            }
            state.channel.clone()
        };
        let Some(channel) = channel else {
            return Ok(());
        };
        for event in events {
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
            state.attach = None;
        }
    }

    fn begin_attach(
        &self,
        next_channel: Channel<AgentChatEvent>,
    ) -> Result<(u64, Vec<AgentChatEvent>), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "agent chat state lock poisoned".to_string())?;
        state.generation = state.generation.wrapping_add(1);
        let generation = state.generation;
        state.channel = Some(next_channel);
        state.attach = Some(AttachState {
            generation,
            pending: VecDeque::new(),
        });
        let replay = state.replay.iter().cloned().collect::<Vec<_>>();
        Ok((generation, replay))
    }

    fn finish_attach(&self, generation: u64, replay: Vec<AgentChatEvent>) -> Result<(), String> {
        self.deliver_batch(generation, replay)?;
        loop {
            let pending = {
                let mut state = self
                    .state
                    .lock()
                    .map_err(|_| "agent chat state lock poisoned".to_string())?;
                let Some(attach) = state.attach.as_mut() else {
                    return Ok(());
                };
                if attach.generation != generation {
                    return Ok(());
                }
                if attach.pending.is_empty() {
                    state.attach = None;
                    return Ok(());
                }
                attach.pending.drain(..).collect::<Vec<_>>()
            };
            self.deliver_batch(generation, pending)?;
        }
    }

    #[cfg(test)]
    fn begin_attach_for_test(
        &self,
        next_channel: Channel<AgentChatEvent>,
    ) -> Result<(u64, Vec<AgentChatEvent>), String> {
        self.begin_attach(next_channel)
    }

    #[cfg(test)]
    fn finish_attach_for_test(
        &self,
        generation: u64,
        replay: Vec<AgentChatEvent>,
    ) -> Result<(), String> {
        self.finish_attach(generation, replay)
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentChatEvent, AgentChatEventSink, REPLAY_EVENT_LIMIT};
    use std::sync::{Arc, OnceLock};
    use tauri::ipc::Channel;

    #[test]
    fn replay_tail_is_bounded() {
        let sink = AgentChatEventSink::new(Channel::new(|_| Ok(())));
        for index in 0..(REPLAY_EVENT_LIMIT + 7) {
            sink.send(AgentChatEvent::Assistant {
                text: index.to_string(),
            });
        }
        assert_eq!(sink.replay_len(), REPLAY_EVENT_LIMIT);
    }

    #[test]
    fn detach_stops_delivery_until_a_new_channel_attaches() {
        use std::sync::{Arc, Mutex};

        let first = Arc::new(Mutex::new(Vec::new()));
        let first_events = Arc::clone(&first);
        let sink = AgentChatEventSink::new(Channel::new(move |event| {
            first_events.lock().unwrap().push(event);
            Ok(())
        }));

        let attachment_token = sink.attachment_token().unwrap();
        assert!(sink.detach_if_current(&attachment_token).unwrap());
        sink.send(AgentChatEvent::Assistant {
            text: "detached".to_string(),
        });
        assert!(first.lock().unwrap().is_empty());

        let second = Arc::new(Mutex::new(Vec::new()));
        let second_events = Arc::clone(&second);
        sink.attach(Channel::new(move |event| {
            second_events.lock().unwrap().push(event);
            Ok(())
        }))
        .unwrap();

        assert_eq!(second.lock().unwrap().len(), 1);
    }

    #[test]
    fn stale_attachment_token_cannot_detach_a_newer_channel() {
        use std::sync::{Arc, Mutex};

        let sink = AgentChatEventSink::new(Channel::new(|_| Ok(())));
        let stale_token = sink.attachment_token().expect("initial attachment token");
        let received = Arc::new(Mutex::new(Vec::new()));
        let received_for_channel = Arc::clone(&received);

        let current_token = sink
            .attach(Channel::new(move |event| {
                received_for_channel.lock().expect("events").push(event);
                Ok(())
            }))
            .expect("new attachment");

        assert_ne!(stale_token, current_token);
        assert!(!sink
            .detach_if_current(&stale_token)
            .expect("stale detach is a no-op"));

        sink.send(AgentChatEvent::Assistant {
            text: "still attached".to_string(),
        });
        assert_eq!(received.lock().expect("events").len(), 1);

        assert!(sink
            .detach_if_current(&current_token)
            .expect("current detach succeeds"));
        sink.send(AgentChatEvent::Assistant {
            text: "detached".to_string(),
        });
        assert_eq!(received.lock().expect("events").len(), 1);
    }

    #[test]
    fn failed_delivery_detaches_the_stale_channel() {
        use std::sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        };

        let deliveries = Arc::new(AtomicUsize::new(0));
        let attempted = Arc::clone(&deliveries);
        let sink = AgentChatEventSink::new(Channel::new(move |_| {
            attempted.fetch_add(1, Ordering::SeqCst);
            Err(tauri::Error::FailedToReceiveMessage)
        }));

        sink.send(AgentChatEvent::Assistant {
            text: "first".to_string(),
        });
        sink.send(AgentChatEvent::Assistant {
            text: "second".to_string(),
        });

        assert_eq!(deliveries.load(Ordering::SeqCst), 1);
        assert!(sink.state.lock().unwrap().channel.is_none());
    }

    #[test]
    fn attach_replays_before_subsequent_live_events() {
        use std::sync::Mutex;

        let first = Channel::new(|_| Ok(()));
        let sink = AgentChatEventSink::new(first);
        sink.send(AgentChatEvent::Assistant {
            text: "replay".to_string(),
        });

        let received = Arc::new(Mutex::new(Vec::new()));
        let received_events = Arc::clone(&received);
        sink.attach(Channel::new(move |event| {
            received_events
                .lock()
                .unwrap()
                .push(event.deserialize::<serde_json::Value>().unwrap());
            Ok(())
        }))
        .unwrap();
        sink.send(AgentChatEvent::Assistant {
            text: "live".to_string(),
        });

        let events = received.lock().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["text"], "replay");
        assert_eq!(events[1]["text"], "live");
    }

    #[test]
    fn send_does_not_hold_the_channel_lock_while_invoking_callbacks() {
        let sink_ref = Arc::new(OnceLock::<Arc<AgentChatEventSink>>::new());
        let sink_ref_for_callback = Arc::clone(&sink_ref);
        let lock_was_available = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let lock_was_available_for_callback = Arc::clone(&lock_was_available);
        let sink = Arc::new(AgentChatEventSink::new(Channel::new(move |_| {
            let sink = sink_ref_for_callback
                .get()
                .expect("sink should be registered before send");
            lock_was_available_for_callback.store(
                sink.state.try_lock().is_ok(),
                std::sync::atomic::Ordering::SeqCst,
            );
            Ok(())
        })));
        assert!(sink_ref.set(Arc::clone(&sink)).is_ok());

        sink.send(AgentChatEvent::Assistant {
            text: "live".to_string(),
        });

        assert!(lock_was_available.load(std::sync::atomic::Ordering::SeqCst));
    }

    #[test]
    fn attach_replay_delivery_does_not_hold_internal_locks_while_invoking_callbacks() {
        use std::sync::{
            atomic::{AtomicBool, Ordering},
            Mutex,
        };

        let sink = Arc::new(AgentChatEventSink::new(Channel::new(|_| Ok(()))));
        sink.send(AgentChatEvent::Assistant {
            text: "replay".to_string(),
        });

        let sink_ref = Arc::new(OnceLock::<Arc<AgentChatEventSink>>::new());
        assert!(sink_ref.set(Arc::clone(&sink)).is_ok());
        let state_lock_available = Arc::new(AtomicBool::new(false));
        let state_lock_available_for_callback = Arc::clone(&state_lock_available);
        let received = Arc::new(Mutex::new(Vec::new()));
        let received_for_callback = Arc::clone(&received);
        let sink_ref_for_callback = Arc::clone(&sink_ref);

        sink.attach(Channel::new(move |event| {
            let sink = sink_ref_for_callback
                .get()
                .expect("sink should be registered before attach");
            state_lock_available_for_callback
                .store(sink.state.try_lock().is_ok(), Ordering::SeqCst);
            received_for_callback.lock().unwrap().push(event);
            Ok(())
        }))
        .unwrap();

        assert!(state_lock_available.load(Ordering::SeqCst));
        assert_eq!(received.lock().unwrap().len(), 1);
    }

    #[test]
    fn overlapping_attaches_do_not_replay_the_first_snapshot_into_the_second_channel() {
        use std::sync::Mutex;

        let sink = AgentChatEventSink::new(Channel::new(|_| Ok(())));
        sink.send(AgentChatEvent::Assistant {
            text: "replay".to_string(),
        });

        let first_received = Arc::new(Mutex::new(Vec::new()));
        let first_received_for_attach = Arc::clone(&first_received);
        let (first_generation, first_replay) = sink
            .begin_attach_for_test(Channel::new(move |event| {
                first_received_for_attach.lock().unwrap().push(event);
                Ok(())
            }))
            .unwrap();

        let second_received = Arc::new(Mutex::new(Vec::new()));
        let second_received_for_attach = Arc::clone(&second_received);
        let (second_generation, second_replay) = sink
            .begin_attach_for_test(Channel::new(move |event| {
                second_received_for_attach.lock().unwrap().push(event);
                Ok(())
            }))
            .unwrap();

        sink.finish_attach_for_test(second_generation, second_replay)
            .unwrap();
        sink.finish_attach_for_test(first_generation, first_replay)
            .unwrap();

        sink.send(AgentChatEvent::Assistant {
            text: "live".to_string(),
        });

        let first_events = first_received.lock().unwrap();
        let second_events = second_received.lock().unwrap();
        assert!(first_events.is_empty());
        assert_eq!(second_events.len(), 2);
        assert_eq!(
            second_events[0]
                .clone()
                .deserialize::<serde_json::Value>()
                .unwrap()["text"],
            "replay"
        );
        assert_eq!(
            second_events[1]
                .clone()
                .deserialize::<serde_json::Value>()
                .unwrap()["text"],
            "live"
        );
    }
}
