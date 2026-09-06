use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) type OutputChunk = (u64, Vec<u8>);
pub(crate) type OutputSubscription = (mpsc::Receiver<OutputChunk>, Vec<OutputChunk>);

const MAX_REPLAY_CHUNKS: usize = 128;

/// Observer hub for PTY output. It owns the bounded replay tail and removes
/// disconnected subscribers as part of publication, so session teardown does
/// not need a second cleanup path.
pub(crate) struct OutputHub {
    subscribers: Mutex<Vec<mpsc::Sender<OutputChunk>>>,
    replay: Mutex<VecDeque<OutputChunk>>,
    sequence: AtomicU64,
    last_publish_ms: AtomicU64,
}

fn wall_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(u64::MAX))
        .unwrap_or_default()
}

impl OutputHub {
    pub(crate) fn new() -> Self {
        Self {
            subscribers: Mutex::new(Vec::new()),
            replay: Mutex::new(VecDeque::new()),
            sequence: AtomicU64::new(1),
            last_publish_ms: AtomicU64::new(0),
        }
    }

    pub(crate) fn snapshot(&self) -> Vec<u8> {
        self.replay
            .lock()
            .unwrap()
            .iter()
            .flat_map(|(_, chunk)| chunk.iter().copied())
            .collect()
    }

    pub(crate) fn subscribe(&self) -> OutputSubscription {
        let (sender, receiver) = mpsc::channel();
        self.subscribers.lock().unwrap().push(sender);
        let replay = self.replay.lock().unwrap().iter().cloned().collect();
        (receiver, replay)
    }

    pub(crate) fn publish(&self, bytes: &[u8]) {
        let sequence = self.sequence.fetch_add(1, Ordering::Relaxed);
        self.last_publish_ms.store(wall_ms(), Ordering::Relaxed);
        let chunk = (sequence, bytes.to_vec());
        let mut subscribers = self.subscribers.lock().unwrap();
        let mut replay = self.replay.lock().unwrap();
        replay.push_back(chunk.clone());
        while replay.len() > MAX_REPLAY_CHUNKS {
            replay.pop_front();
        }
        subscribers.retain(|sender| sender.send(chunk.clone()).is_ok());
    }

    pub(crate) fn last_publish_ms(&self) -> u64 {
        self.last_publish_ms.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::OutputHub;

    #[test]
    fn replay_is_bounded_to_the_latest_chunks() {
        let hub = OutputHub::new();
        for value in 0..130u8 {
            hub.publish(&[value]);
        }

        let (_receiver, replay) = hub.subscribe();
        assert_eq!(replay.len(), 128);
        assert_eq!(replay.first().map(|(_, chunk)| chunk[0]), Some(2));
        assert_eq!(replay.last().map(|(_, chunk)| chunk[0]), Some(129));
    }

    #[test]
    fn disconnected_subscribers_are_removed_on_publish() {
        let hub = OutputHub::new();
        let (receiver, _replay) = hub.subscribe();
        drop(receiver);

        hub.publish(b"first");
        let (_receiver, replay) = hub.subscribe();
        assert_eq!(replay.len(), 1);
    }

    #[test]
    fn last_publish_ms_tracks_output_recency() {
        let hub = OutputHub::new();
        assert_eq!(hub.last_publish_ms(), 0);
        hub.publish(b"hello");
        let first = hub.last_publish_ms();
        assert!(first > 0);
        hub.publish(b"world");
        assert!(hub.last_publish_ms() >= first);
    }
}
