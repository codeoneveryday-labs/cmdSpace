//! Native desktop speech recognition for cmdSpace's voice prompt agent.
//!
//! WebKit advertises `webkitSpeechRecognition`, but it does not reliably emit
//! transcription results inside Tauri's WKWebView. Capture and recognition
//! therefore live in the macOS Speech framework, while the webview only owns
//! the voice-agent UI and prompt-rewrite flow.

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::{AppHandle, Emitter};

#[path = "speech_commands.rs"]
mod commands;
#[cfg(target_os = "windows")]
#[path = "speech_windows.rs"]
mod windows;
#[cfg(any(target_os = "windows", test))]
#[path = "speech_windows_lifecycle.rs"]
mod windows_lifecycle;
pub use commands::{
    __cmd__speech_start, __cmd__speech_stop, __cmd__speech_supported_locales, speech_start,
    speech_stop, speech_supported_locales,
};

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn emit_error(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit("cmdspace:speech-error", message.into());
}

#[cfg(target_os = "macos")]
#[path = "speech_macos_lifecycle.rs"]
mod macos_lifecycle;
#[cfg(target_os = "macos")]
#[path = "speech_macos_state.rs"]
mod macos_state;
#[cfg(target_os = "macos")]
#[path = "speech_macos_support.rs"]
mod macos_support;
#[cfg(target_os = "macos")]
mod macos {
    use super::emit_error;
    use block2::RcBlock;
    use objc2::{runtime::Bool, AnyThread};
    use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
    use objc2_avf_audio::{AVAudioEngine, AVAudioPCMBuffer, AVAudioTime};
    use objc2_foundation::{NSError, NSLocale, NSString};
    use objc2_speech::{
        SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognizer,
        SFSpeechRecognizerAuthorizationStatus,
    };
    use std::ptr::NonNull;
    use std::slice;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    use super::macos_state::{
        activate_session, begin_finish_active_session, complete_request, invalidate_request,
        is_current_request, remember_latest_transcript, should_deliver_event, start_request,
        take_latest_transcript, with_active_session, SpeechSession,
    };
    use super::macos_support::{
        microphone_permission_message, runs_from_macos_app_bundle,
        should_recover_partial_transcript, should_retry_audio_start, speech_error_message,
    };

    const AUDIO_START_RETRY_DELAY: Duration = Duration::from_millis(350);

    pub fn supported_locales() -> Vec<String> {
        let locales = unsafe { SFSpeechRecognizer::supportedLocales() };
        let locales = locales.allObjects();
        let mut identifiers = (0..locales.count())
            .map(|index| {
                locales
                    .objectAtIndex(index)
                    .localeIdentifier()
                    .to_string()
                    .replace('_', "-")
            })
            .filter(|identifier| !identifier.is_empty())
            .collect::<Vec<_>>();

        identifiers.sort_unstable();
        identifiers.dedup();
        identifiers
    }

    pub fn start(app: AppHandle, language: Option<String>) -> Result<(), String> {
        if !runs_from_macos_app_bundle() {
            return Err(
                "Native voice cannot run from `tauri dev` on macOS. Run `pnpm voice:debug` to test it from a debug app bundle."
                    .to_string(),
            );
        }
        let app_for_main = app.clone();
        app.run_on_main_thread(move || start_on_main(app_for_main, language))
            .map_err(|error| error.to_string())
    }

    pub fn stop(app: AppHandle) -> Result<(), String> {
        let app_for_main = app.clone();
        app.run_on_main_thread(move || {
            invalidate_request_on_main();
            finish_on_main(&app_for_main);
        })
        .map_err(|error| error.to_string())
    }

    fn start_on_main(app: AppHandle, language: Option<String>) {
        let started = start_request();
        if let Some(session) = started.cancelled_session {
            dispose_session(session, true);
        }

        request_microphone_permission(app, started.request_id, language);
    }

    fn request_microphone_permission(app: AppHandle, request_id: u64, language: Option<String>) {
        let media_type =
            unsafe { AVMediaTypeAudio.expect("AVFoundation must expose the audio media type") };
        let permission = unsafe { AVCaptureDevice::authorizationStatusForMediaType(media_type) };
        if permission == AVAuthorizationStatus::Authorized {
            request_speech_authorization(app, request_id, language);
            return;
        }
        if permission != AVAuthorizationStatus::NotDetermined {
            emit_error(&app, microphone_permission_message());
            return;
        }

        let app_for_permission = app.clone();
        let language_for_permission = language.clone();
        let authorization = RcBlock::new(move |granted: Bool| {
            let app_for_main = app_for_permission.clone();
            let language_for_session = language_for_permission.clone();
            let _ = app_for_permission.run_on_main_thread(move || {
                if !is_current_request(request_id) {
                    return;
                }
                if granted.as_bool() {
                    request_speech_authorization(app_for_main, request_id, language_for_session);
                } else {
                    emit_error(&app_for_main, microphone_permission_message());
                }
            });
        });
        unsafe {
            AVCaptureDevice::requestAccessForMediaType_completionHandler(media_type, &authorization)
        };
    }

    fn request_speech_authorization(app: AppHandle, request_id: u64, language: Option<String>) {
        let status = unsafe { SFSpeechRecognizer::authorizationStatus() };
        if status == SFSpeechRecognizerAuthorizationStatus::Authorized {
            begin_session(app, request_id, language, 1);
            return;
        }

        let app_for_authorization = app.clone();
        let language_for_authorization = language.clone();
        let authorization = RcBlock::new(move |next_status| {
            let app_for_main = app_for_authorization.clone();
            let language_for_session = language_for_authorization.clone();
            let _ = app_for_authorization.run_on_main_thread(move || {
                if !is_current_request(request_id) {
                    return;
                }
                if next_status == SFSpeechRecognizerAuthorizationStatus::Authorized {
                    begin_session(app_for_main, request_id, language_for_session, 1);
                } else {
                    emit_error(
                        &app_for_main,
                        "Allow Speech Recognition for cmdSpace in macOS Settings, then try again.",
                    );
                }
            });
        });
        unsafe { SFSpeechRecognizer::requestAuthorization(&authorization) };
    }

    fn invalidate_request_on_main() {
        invalidate_request();
    }

    fn begin_session(app: AppHandle, request_id: u64, language: Option<String>, attempt: u8) {
        if !is_current_request(request_id) {
            return;
        }
        let recognizer = match language.as_deref() {
            Some(locale_identifier) => {
                let locale_name = NSString::from_str(locale_identifier);
                let locale = NSLocale::initWithLocaleIdentifier(NSLocale::alloc(), &locale_name);
                let Some(recognizer) = (unsafe {
                    SFSpeechRecognizer::initWithLocale(SFSpeechRecognizer::alloc(), &locale)
                }) else {
                    emit_language_unavailable(&app, locale_identifier);
                    return;
                };
                recognizer
            }
            None => unsafe { SFSpeechRecognizer::new() },
        };
        if !unsafe { recognizer.isAvailable() } {
            if let Some(locale_identifier) = language.as_deref() {
                emit_language_unavailable(&app, locale_identifier);
            } else {
                emit_error(
                    &app,
                    "Speech recognition is temporarily unavailable. Try again shortly.",
                );
            }
            return;
        }

        let request = unsafe { SFSpeechAudioBufferRecognitionRequest::new() };
        unsafe { request.setShouldReportPartialResults(true) };

        let engine = unsafe { AVAudioEngine::new() };
        let input = unsafe { engine.inputNode() };
        // A tap must use the input node's negotiated hardware format. Letting
        // AVFoundation infer it can yield silent PCM buffers in a bundled app.
        let input_format = unsafe { input.outputFormatForBus(0) };
        let request_for_tap = request.clone();
        let app_for_levels = app.clone();
        let tap = RcBlock::new(
            move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| unsafe {
                request_for_tap.appendAudioPCMBuffer(buffer.as_ref());
                emit_level_for_active_request(
                    app_for_levels.clone(),
                    request_id,
                    microphone_level(buffer.as_ref()),
                );
            },
        );
        unsafe {
            input.installTapOnBus_bufferSize_format_block(
                0,
                1_024,
                Some(&input_format),
                RcBlock::as_ptr(&tap),
            );
        }

        let app_for_results = app.clone();
        let result_handler = RcBlock::new(
            move |result: *mut SFSpeechRecognitionResult, error: *mut NSError| {
                if !error.is_null() {
                    let error = unsafe { &*error };
                    let domain = error.domain().to_string();
                    let code = error.code();
                    handle_recognition_error(
                        app_for_results.clone(),
                        request_id,
                        speech_error_message(error),
                        domain == "kAFAssistantErrorDomain" && code == 1110,
                    );
                    return;
                }
                let Some(result) = (unsafe { result.as_ref() }) else {
                    return;
                };
                let transcript =
                    unsafe { result.bestTranscription().formattedString().to_string() };
                let transcript = transcript.trim();
                if transcript.is_empty() {
                    return;
                }
                let final_result = unsafe { result.isFinal() };
                handle_recognition_result(
                    app_for_results.clone(),
                    request_id,
                    transcript.to_string(),
                    final_result,
                );
            },
        );
        let task = unsafe {
            recognizer.recognitionTaskWithRequest_resultHandler(&request, &result_handler)
        };

        unsafe { engine.prepare() };
        if let Err(error) = unsafe { engine.startAndReturnError() } {
            unsafe { input.removeTapOnBus(0) };
            if should_retry_audio_start(attempt) {
                schedule_audio_start_retry(app, request_id, language, attempt);
            } else {
                emit_error(
                    &app,
                    format!(
                        "Could not start the microphone. Make sure your Bluetooth headset microphone is selected in macOS System Settings → Sound → Input, then try again. Details: {error}"
                    ),
                );
            }
            return;
        }

        let session = SpeechSession {
            engine,
            input,
            request,
            _recognizer: recognizer,
            _task: task,
            latest_transcript: std::cell::RefCell::new(None),
        };
        if let Err(stale_session) = activate_session(request_id, session) {
            dispose_session(stale_session, true);
            return;
        }
        let _ = app.emit("cmdspace:speech-started", ());
    }

    fn schedule_audio_start_retry(
        app: AppHandle,
        request_id: u64,
        language: Option<String>,
        attempt: u8,
    ) {
        std::thread::spawn(move || {
            // macOS can report the Bluetooth input before its hardware driver has
            // finished changing format. Rebuild the graph after the route settles.
            std::thread::sleep(AUDIO_START_RETRY_DELAY);
            let app_for_main = app.clone();
            let _ = app.run_on_main_thread(move || {
                if is_current_request(request_id) {
                    begin_session(
                        app_for_main,
                        request_id,
                        language,
                        attempt.saturating_add(1),
                    );
                }
            });
        });
    }

    fn emit_language_unavailable(app: &AppHandle, locale_identifier: &str) {
        let language = match locale_identifier {
            "vi-VN" => "Vietnamese",
            "en-US" => "English (United States)",
            "en-GB" => "English (United Kingdom)",
            "ja-JP" => "Japanese",
            "ko-KR" => "Korean",
            "zh-CN" => "Chinese, Simplified",
            _ => "The selected language",
        };
        emit_error(
            app,
            format!(
                "{language} Dictation is unavailable. Add it in macOS System Settings → Keyboard → Dictation, then try again."
            ),
        );
    }

    /// Converts the first microphone channel into a small, display-ready RMS level.
    /// A missing float buffer is normal for unsupported capture formats, so it renders
    /// as silence instead of interrupting recognition.
    fn microphone_level(buffer: &AVAudioPCMBuffer) -> f32 {
        let frame_count = unsafe { buffer.frameLength() } as usize;
        if frame_count == 0 {
            return 0.0;
        }

        let Some(channels) = NonNull::new(unsafe { buffer.floatChannelData() }) else {
            return 0.0;
        };
        let stride = unsafe { buffer.stride() };
        if stride == 0 {
            return 0.0;
        }
        let Some(sample_count) = frame_count
            .checked_sub(1)
            .and_then(|last_frame| last_frame.checked_mul(stride))
            .and_then(|offset| offset.checked_add(1))
        else {
            return 0.0;
        };
        let first_channel = unsafe { *channels.as_ptr() };
        let samples = unsafe { slice::from_raw_parts(first_channel.as_ptr(), sample_count) };
        let energy = samples
            .iter()
            .step_by(stride)
            .map(|sample| sample * sample)
            .sum::<f32>();
        let rms = (energy / frame_count as f32).sqrt();

        if rms.is_finite() {
            (rms * 8.0).clamp(0.0, 1.0)
        } else {
            0.0
        }
    }

    /// End audio input but retain the task until Speech emits its final result.
    /// Dropping the request or task here loses the final words the user spoke.
    fn finish_on_main(app: &AppHandle) {
        if !begin_finish_active_session() {
            return;
        }
        with_active_session(|session| unsafe {
            session.input.removeTapOnBus(0);
            session.engine.stop();
            session.request.endAudio();
            session._task.finish();
        });
        let _ = app.emit("cmdspace:speech-stopped", ());
    }

    fn emit_level_for_active_request(app: AppHandle, request_id: u64, level: f32) {
        let app_for_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            if should_deliver_event(request_id) {
                let _ = app_for_main.emit("cmdspace:speech-level", level);
            }
        });
    }

    fn handle_recognition_error(
        app: AppHandle,
        request_id: u64,
        message: String,
        is_no_speech_error: bool,
    ) {
        let app_for_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            if should_deliver_event(request_id) {
                let partial = take_latest_transcript(request_id).unwrap_or_default();
                if should_recover_partial_transcript(is_no_speech_error, &partial) {
                    let _ = app_for_main.emit(
                        "cmdspace:speech-result",
                        serde_json::json!({
                            "text": partial,
                            "final": true,
                        }),
                    );
                } else {
                    emit_error(&app_for_main, message);
                }
            }
            clear_session_for_result_on_main(&app_for_main, request_id);
        });
    }

    fn handle_recognition_result(
        app: AppHandle,
        request_id: u64,
        transcript: String,
        final_result: bool,
    ) {
        let app_for_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            if should_deliver_event(request_id) {
                remember_latest_transcript(request_id, transcript.clone());
                let _ = app_for_main.emit(
                    "cmdspace:speech-result",
                    serde_json::json!({ "text": transcript, "final": final_result }),
                );
            }
            if final_result {
                clear_session_for_result_on_main(&app_for_main, request_id);
            }
        });
    }

    fn clear_session_for_result_on_main(app: &AppHandle, request_id: u64) {
        let completed = complete_request(request_id);
        if let Some(session) = completed.session {
            dispose_session(session, false);
        }
        if completed.emit_stopped {
            let _ = app.emit("cmdspace:speech-stopped", ());
        }
    }

    fn dispose_session(session: SpeechSession, cancel_task: bool) {
        unsafe {
            session.input.removeTapOnBus(0);
            session.engine.stop();
            session.request.endAudio();
            if cancel_task {
                session._task.cancel();
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::{invalidate_request_on_main, is_current_request, start_request};

        #[test]
        fn invalidated_request_cannot_restart_after_retry_delay() {
            let request_id = start_request().request_id;
            assert!(is_current_request(request_id));

            invalidate_request_on_main();

            assert!(!is_current_request(request_id));
        }
    }
}
