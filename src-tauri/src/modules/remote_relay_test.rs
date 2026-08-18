use super::remote_relay::{RelayHeartbeat, RemoteRelayIdentity};
use std::time::{Duration, Instant};

#[test]
fn relay_identity_is_stable_after_the_desktop_restarts() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("remote-relay.json");

    let created = RemoteRelayIdentity::load_or_create(&path).unwrap();
    let restored = RemoteRelayIdentity::load_or_create(&path).unwrap();

    assert_eq!(created.relay_id, restored.relay_id);
    assert_eq!(created.credential, restored.credential);
    assert!(created.endpoint().ends_with(&created.relay_id));
}

#[test]
fn relay_heartbeat_reconnects_when_the_worker_stops_acknowledging() {
    let now = Instant::now();
    let mut heartbeat = RelayHeartbeat::new(now);
    let sent_at = now + Duration::from_secs(10);

    assert!(heartbeat.should_send(sent_at));
    heartbeat.record_sent(sent_at);
    assert!(heartbeat.has_timed_out(sent_at + Duration::from_secs(30)));
}
