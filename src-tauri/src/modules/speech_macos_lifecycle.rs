#[derive(Debug, PartialEq, Eq)]
pub(super) struct SpeechLifecycle<Session> {
    current_request_id: u64,
    active_session: Option<ActiveSpeechSession<Session>>,
}

#[derive(Debug, PartialEq, Eq)]
struct ActiveSpeechSession<Session> {
    request_id: u64,
    stopped_emitted: bool,
    session: Session,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) struct StartedRequest<Session> {
    pub(super) request_id: u64,
    pub(super) cancelled_session: Option<Session>,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) struct CompletedRequest<Session> {
    pub(super) session: Option<Session>,
    pub(super) emit_stopped: bool,
}

impl<Session> Default for SpeechLifecycle<Session> {
    fn default() -> Self {
        Self::new()
    }
}

impl<Session> SpeechLifecycle<Session> {
    pub(super) const fn new() -> Self {
        Self {
            current_request_id: 0,
            active_session: None,
        }
    }

    pub(super) fn start_request(&mut self) -> StartedRequest<Session> {
        self.current_request_id = next_request_id(self.current_request_id);
        StartedRequest {
            request_id: self.current_request_id,
            cancelled_session: self.active_session.take().map(|active| active.session),
        }
    }

    pub(super) fn invalidate_request(&mut self) {
        self.current_request_id = next_request_id(self.current_request_id);
    }

    pub(super) fn is_current_request(&self, request_id: u64) -> bool {
        self.current_request_id == request_id
    }

    pub(super) fn activate_session(
        &mut self,
        request_id: u64,
        session: Session,
    ) -> Result<(), Session> {
        if !self.is_current_request(request_id) {
            return Err(session);
        }
        self.active_session = Some(ActiveSpeechSession {
            request_id,
            stopped_emitted: false,
            session,
        });
        Ok(())
    }

    /// Returns the request that may still publish events. A finishing request
    /// remains eligible for its final transcript until a later start replaces
    /// its session.
    pub(super) fn event_delivery_request_id(&self) -> Option<u64> {
        self.active_session.as_ref().map(|active| active.request_id)
    }

    /// Marks the active session as already stopped before ending its audio.
    /// Its late final/error callback still owns cleanup, but must not emit a
    /// duplicate stopped event.
    pub(super) fn begin_finish_active_session(&mut self) -> bool {
        let Some(active) = self.active_session.as_mut() else {
            return false;
        };
        if active.stopped_emitted {
            return false;
        }

        active.stopped_emitted = true;
        true
    }

    pub(super) fn with_active_session<R>(&self, map: impl FnOnce(&Session) -> R) -> Option<R> {
        self.active_session
            .as_ref()
            .map(|active| map(&active.session))
    }

    #[cfg(test)]
    pub(super) fn take_active_session(&mut self) -> Option<Session> {
        self.active_session.take().map(|active| active.session)
    }

    pub(super) fn complete_request(&mut self, request_id: u64) -> CompletedRequest<Session> {
        let Some(active) = self.active_session.as_ref() else {
            return CompletedRequest {
                session: None,
                emit_stopped: false,
            };
        };
        if active.request_id != request_id {
            return CompletedRequest {
                session: None,
                emit_stopped: false,
            };
        }

        let Some(active) = self.active_session.take() else {
            return CompletedRequest {
                session: None,
                emit_stopped: false,
            };
        };
        CompletedRequest {
            session: Some(active.session),
            emit_stopped: !active.stopped_emitted,
        }
    }
}

fn next_request_id(current_request_id: u64) -> u64 {
    current_request_id.wrapping_add(1).max(1)
}

#[cfg(test)]
mod tests {
    use super::SpeechLifecycle;

    #[test]
    fn start_request_should_cancel_the_existing_session_and_advance_the_request_id() {
        let mut lifecycle = SpeechLifecycle::default();
        let started = lifecycle.start_request();
        assert_eq!(started.request_id, 1);
        assert_eq!(started.cancelled_session, None);

        lifecycle
            .activate_session(started.request_id, 7_u8)
            .expect("current request accepts a session");

        let restarted = lifecycle.start_request();
        assert_eq!(restarted.request_id, 2);
        assert_eq!(restarted.cancelled_session, Some(7));
    }

    #[test]
    fn complete_request_should_leave_a_newer_session_active_when_an_older_result_arrives() {
        let mut lifecycle = SpeechLifecycle::default();
        let first_request = lifecycle.start_request().request_id;
        lifecycle
            .activate_session(first_request, 11_u8)
            .expect("first request accepts a session");

        let second_request = lifecycle.start_request().request_id;
        lifecycle
            .activate_session(second_request, 22_u8)
            .expect("second request accepts a session");

        let completed = lifecycle.complete_request(first_request);

        assert_eq!(completed.session, None);
        assert!(!completed.emit_stopped);
        assert!(
            lifecycle
                .with_active_session(|session| *session == 22)
                .unwrap_or(false),
            "stale completion must not take the current session"
        );
    }

    #[test]
    fn invalidate_request_should_block_late_retry_or_session_activation() {
        let mut lifecycle = SpeechLifecycle::<u8>::default();
        let request_id = lifecycle.start_request().request_id;

        lifecycle.invalidate_request();

        assert!(!lifecycle.is_current_request(request_id));
        assert_eq!(lifecycle.activate_session(request_id, 9_u8), Err(9_u8));
    }

    #[test]
    fn complete_request_should_release_the_stopped_session_after_invalidation() {
        let mut lifecycle = SpeechLifecycle::default();
        let request_id = lifecycle.start_request().request_id;
        lifecycle
            .activate_session(request_id, 33_u8)
            .expect("request accepts an active session");

        lifecycle.invalidate_request();
        assert!(lifecycle.begin_finish_active_session());

        let completed = lifecycle.complete_request(request_id);

        assert_eq!(completed.session, Some(33));
        assert!(
            !completed.emit_stopped,
            "finishing a request already emitted its stopped event"
        );
        assert_eq!(lifecycle.take_active_session(), None);
    }

    #[test]
    fn event_delivery_should_stop_when_a_newer_request_replaces_the_active_session() {
        let mut lifecycle = SpeechLifecycle::default();
        let first_request = lifecycle.start_request().request_id;
        lifecycle
            .activate_session(first_request, 11_u8)
            .expect("first request accepts a session");
        assert_eq!(
            lifecycle.event_delivery_request_id(),
            Some(first_request),
            "the active request may publish native events"
        );

        assert!(lifecycle.begin_finish_active_session());
        assert_eq!(
            lifecycle.event_delivery_request_id(),
            Some(first_request),
            "a confirmed request keeps its final result eligible until replacement"
        );

        let second_request = lifecycle.start_request().request_id;
        assert_eq!(
            lifecycle.event_delivery_request_id(),
            None,
            "replacing the session must suppress queued callbacks from the previous request"
        );
        lifecycle
            .activate_session(second_request, 22_u8)
            .expect("second request accepts a session");

        assert_eq!(lifecycle.event_delivery_request_id(), Some(second_request));
        assert_ne!(lifecycle.event_delivery_request_id(), Some(first_request));
    }
}
