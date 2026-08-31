use std::cell::RefCell;

use objc2::rc::Retained;
use objc2_avf_audio::{AVAudioEngine, AVAudioInputNode};
use objc2_speech::{
    SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionTask, SFSpeechRecognizer,
};

use super::macos_lifecycle::{CompletedRequest, SpeechLifecycle, StartedRequest};

pub(super) struct SpeechSession {
    pub(super) engine: Retained<AVAudioEngine>,
    pub(super) input: Retained<AVAudioInputNode>,
    pub(super) request: Retained<SFSpeechAudioBufferRecognitionRequest>,
    pub(super) _recognizer: Retained<SFSpeechRecognizer>,
    pub(super) _task: Retained<SFSpeechRecognitionTask>,
}

thread_local! {
    static LIFECYCLE: RefCell<SpeechLifecycle<SpeechSession>> =
        const { RefCell::new(SpeechLifecycle::new()) };
}

pub(super) fn start_request() -> StartedRequest<SpeechSession> {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow_mut().start_request())
}

pub(super) fn invalidate_request() {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow_mut().invalidate_request());
}

pub(super) fn is_current_request(request_id: u64) -> bool {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow().is_current_request(request_id))
}

/// This is called only after a callback is dispatched back to the main thread.
/// The lifecycle remains the sole owner of the native session; this merely
/// decides whether that session may publish an observer event.
pub(super) fn should_deliver_event(request_id: u64) -> bool {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow().event_delivery_request_id() == Some(request_id))
}

pub(super) fn activate_session(
    request_id: u64,
    session: SpeechSession,
) -> Result<(), SpeechSession> {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow_mut().activate_session(request_id, session))
}

pub(super) fn with_active_session<R>(map: impl FnOnce(&SpeechSession) -> R) -> Option<R> {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow().with_active_session(map))
}

pub(super) fn begin_finish_active_session() -> bool {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow_mut().begin_finish_active_session())
}

pub(super) fn complete_request(request_id: u64) -> CompletedRequest<SpeechSession> {
    LIFECYCLE.with(|lifecycle| lifecycle.borrow_mut().complete_request(request_id))
}
