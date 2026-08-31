#[derive(Debug, PartialEq, Eq)]
pub(super) struct SpeechLifecycle<Session> {
    active_session: Option<ActiveSpeechSession<Session>>,
}

#[derive(Debug, PartialEq, Eq)]
struct ActiveSpeechSession<Session> {
    id: u64,
    session: Session,
}

impl<Session> Default for SpeechLifecycle<Session> {
    fn default() -> Self {
        Self::new()
    }
}

impl<Session> SpeechLifecycle<Session> {
    pub(super) const fn new() -> Self {
        Self {
            active_session: None,
        }
    }

    pub(super) fn replace_session(&mut self, id: u64, session: Session) -> Option<Session> {
        self.active_session
            .replace(ActiveSpeechSession { id, session })
            .map(|active| active.session)
    }

    pub(super) fn take_active_session(&mut self) -> Option<Session> {
        self.active_session.take().map(|active| active.session)
    }

    /// Runs `emit` only while this session remains current. Callers hold their
    /// session mutex for the closure so a replacement cannot interleave
    /// between the identity check and observer publication.
    pub(super) fn emit_if_current<Output>(
        &self,
        id: u64,
        emit: impl FnOnce() -> Output,
    ) -> Option<Output> {
        (self.active_session.as_ref()?.id == id).then(emit)
    }

    /// Removes and completes a session only if it remains current. The
    /// completion closure runs under the caller's session mutex, making final
    /// no-speech/stopped events ordered before a replacement session starts.
    pub(super) fn finish_if_current<Output>(
        &mut self,
        id: u64,
        finish: impl FnOnce(Session) -> Output,
    ) -> Option<Output> {
        if self.active_session.as_ref()?.id != id {
            return None;
        }

        self.active_session
            .take()
            .map(|active| finish(active.session))
    }
}

#[cfg(test)]
mod tests {
    use super::SpeechLifecycle;

    #[test]
    fn replaced_session_should_not_publish_buffered_observer_events() {
        let mut lifecycle = SpeechLifecycle::default();
        lifecycle.replace_session(1, "replaced session");
        lifecycle.replace_session(2, "current session");
        let mut published = Vec::new();

        for event in ["level", "result", "error"] {
            assert!(
                lifecycle
                    .emit_if_current(1, || published.push(event))
                    .is_none(),
                "a buffered {event} event from a replaced session must be ignored"
            );
        }

        assert!(published.is_empty());
    }

    #[test]
    fn stale_completion_should_not_clear_or_finish_the_replacement_session() {
        let mut lifecycle = SpeechLifecycle::default();
        lifecycle.replace_session(1, "replaced session");
        lifecycle.replace_session(2, "current session");

        assert!(
            lifecycle.finish_if_current(1, |_| "stopped").is_none(),
            "a replaced child must not publish final no-speech/stopped events"
        );

        assert_eq!(
            lifecycle.emit_if_current(2, || "current event"),
            Some("current event")
        );
    }

    #[test]
    fn current_completion_should_release_the_active_session_after_its_events() {
        let mut lifecycle = SpeechLifecycle::default();
        lifecycle.replace_session(7, "current session");

        assert_eq!(
            lifecycle.finish_if_current(7, |_| "stopped"),
            Some("stopped")
        );

        assert_eq!(lifecycle.take_active_session(), None);
    }
}
