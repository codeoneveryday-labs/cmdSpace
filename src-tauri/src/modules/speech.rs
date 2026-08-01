//! Native desktop speech recognition for cmdSpace's voice prompt agent.
//!
//! WebKit advertises `webkitSpeechRecognition`, but it does not reliably emit
//! transcription results inside Tauri's WKWebView. Capture and recognition
//! therefore live in the macOS Speech framework, while the webview only owns
//! the voice-agent UI and prompt-rewrite flow.

use tauri::AppHandle;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::Emitter;

/// Returns the locales that macOS Speech currently makes available to this app.
///
/// The frontend keeps a small fallback list for non-macOS builds or transient
/// native failures, but this command is the source of truth on a Mac.
#[tauri::command]
pub fn speech_supported_locales() -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos::supported_locales())
    }

    #[cfg(target_os = "windows")]
    {
        windows::supported_locales()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn speech_start(app: AppHandle, language: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::start(app, language)
    }

    #[cfg(target_os = "windows")]
    {
        windows::start(app, language)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, language);
        Err(
            "Native speech recognition is currently available on macOS and Windows only."
                .to_string(),
        )
    }
}

#[tauri::command]
pub fn speech_stop(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::stop(app)
    }

    #[cfg(target_os = "windows")]
    {
        windows::stop(app)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
        Err(
            "Native speech recognition is currently available on macOS and Windows only."
                .to_string(),
        )
    }
}

/// Windows Speech Recognition is exposed through the desktop SAPI/.NET
/// `System.Speech` runtime. Unlike the newer WinRT recognizer, it works when
/// cmdSpace is unpackaged (development and NSIS builds), so it is the correct
/// native backend for the existing Tauri distribution.
#[cfg(target_os = "windows")]
mod windows {
    use super::emit_error;
    use std::{
        io::{BufRead, BufReader},
        process::{Child, Command, Stdio},
        sync::{
            atomic::{AtomicU64, Ordering},
            Mutex, OnceLock,
        },
    };
    use tauri::{AppHandle, Emitter};

    static SESSION: OnceLock<Mutex<Option<SpeechSession>>> = OnceLock::new();
    static REQUEST_ID: AtomicU64 = AtomicU64::new(0);

    struct SpeechSession {
        id: u64,
        child: Child,
    }

    fn session() -> &'static Mutex<Option<SpeechSession>> {
        SESSION.get_or_init(|| Mutex::new(None))
    }

    pub fn supported_locales() -> Result<Vec<String>, String> {
        let output = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                INSTALLED_LOCALES_SCRIPT,
            ])
            .output()
            .map_err(|error| format!("Could not query Windows Speech languages: {error}"))?;

        if !output.status.success() {
            return Err("Windows Speech Recognition is unavailable. Install a Speech language in Windows Settings, then try again.".to_string());
        }

        let mut locales = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(str::trim)
            .filter(|locale| !locale.is_empty())
            .map(|locale| locale.replace('_', "-"))
            .collect::<Vec<_>>();
        locales.sort_unstable();
        locales.dedup();
        Ok(locales)
    }

    pub fn start(app: AppHandle, language: Option<String>) -> Result<(), String> {
        cancel_active_session();

        let id = REQUEST_ID
            .fetch_add(1, Ordering::Relaxed)
            .wrapping_add(1)
            .max(1);
        let mut child = Command::new("powershell.exe")
            .args([
                "-Sta",
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                RECOGNIZER_SCRIPT,
            ])
            .env("CMDSPACE_SPEECH_LANGUAGE", language.unwrap_or_default())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Could not start Windows Speech Recognition: {error}"))?;
        let stdout = child.stdout.take().ok_or_else(|| {
            "Windows Speech Recognition did not expose its output stream.".to_string()
        })?;

        {
            let mut active = session()
                .lock()
                .map_err(|_| "Windows Speech Recognition session lock was poisoned.".to_string())?;
            *active = Some(SpeechSession { id, child });
        }

        let app_for_events = app.clone();
        std::thread::spawn(move || forward_events(app_for_events, id, stdout));
        let _ = app.emit("cmdspace:speech-started", ());
        Ok(())
    }

    pub fn stop(app: AppHandle) -> Result<(), String> {
        stop_active_session();
        let _ = app.emit("cmdspace:speech-stopped", ());
        Ok(())
    }

    fn cancel_active_session() {
        if let Ok(mut active) = session().lock() {
            if let Some(mut previous) = active.take() {
                let _ = previous.child.kill();
                let _ = previous.child.wait();
            }
        }
    }

    fn stop_active_session() {
        cancel_active_session();
    }

    fn forward_events(app: AppHandle, id: u64, stdout: impl std::io::Read) {
        let mut saw_result = false;
        let mut saw_error = false;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else {
                continue;
            };
            match event.get("type").and_then(serde_json::Value::as_str) {
                Some("level") => {
                    let level = event
                        .get("level")
                        .and_then(serde_json::Value::as_f64)
                        .unwrap_or_default()
                        .clamp(0.0, 1.0) as f32;
                    let _ = app.emit("cmdspace:speech-level", level);
                }
                Some("result") => {
                    let Some(text) = event
                        .get("text")
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|text| !text.is_empty())
                    else {
                        continue;
                    };
                    let final_result = event
                        .get("final")
                        .and_then(serde_json::Value::as_bool)
                        .unwrap_or(true);
                    if final_result {
                        saw_result = true;
                    }
                    let _ = app.emit(
                        "cmdspace:speech-result",
                        serde_json::json!({ "text": text, "final": final_result }),
                    );
                }
                Some("error") => {
                    saw_error = true;
                    emit_error(
                        &app,
                        event
                            .get("message")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("Windows Speech Recognition could not complete. Try again."),
                    );
                }
                _ => {}
            }
        }

        if finish_session(id) {
            if !saw_result && !saw_error {
                emit_error(&app, "No speech was detected. Try again.");
            }
            let _ = app.emit("cmdspace:speech-stopped", ());
        }
    }

    fn finish_session(id: u64) -> bool {
        let Ok(mut active) = session().lock() else {
            return false;
        };
        let Some(current) = active.as_ref() else {
            return false;
        };
        if current.id != id {
            return false;
        }
        active.take();
        true
    }

    const INSTALLED_LOCALES_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
    ForEach-Object { $_.Culture.Name } |
    Sort-Object -Unique
"#;

    const RECOGNIZER_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$SpeechAssembly = [System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location
Add-Type -ReferencedAssemblies $SpeechAssembly -TypeDefinition @'
using System;
using System.Globalization;
using System.Linq;
using System.Speech.Recognition;
using System.Threading;

public static class CmdSpaceSpeech {
    private static string Escape(string value) {
        return (value ?? string.Empty)
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private static void Emit(string type, string body) {
        Console.Out.WriteLine("{\\\"type\\\":\\\"" + type + "\\\"" + body + "}");
        Console.Out.Flush();
    }

    private static void EmitError(string message) {
        Emit("error", ",\\\"message\\\":\\\"" + Escape(message) + "\\\"");
    }

    private static void EmitResult(string text, bool finalResult) {
        Emit("result", ",\\\"text\\\":\\\"" + Escape(text) + "\\\",\\\"final\\\":" + (finalResult ? "true" : "false"));
    }

    private static void EmitLevel(int level) {
        var normalized = Math.Max(0, Math.Min(100, level)) / 100.0;
        Emit("level", ",\\\"level\\\":" + normalized.ToString(CultureInfo.InvariantCulture));
    }

    public static int Run(string requestedLanguage) {
        try {
            var requested = (requestedLanguage ?? string.Empty).Replace('_', '-');
            var recognizerInfo = SpeechRecognitionEngine.InstalledRecognizers()
                .FirstOrDefault(info => string.IsNullOrWhiteSpace(requested) ||
                    string.Equals(info.Culture.Name, requested, StringComparison.OrdinalIgnoreCase));
            if (recognizerInfo == null) {
                EmitError("The selected speech language is unavailable. Install its Speech package in Windows Settings → Time & language → Language & region, then try again.");
                return 2;
            }

            using (var recognizer = new SpeechRecognitionEngine(recognizerInfo))
            using (var completed = new ManualResetEvent(false)) {
                var recognized = false;
                var failed = false;
                recognizer.LoadGrammar(new DictationGrammar());
                recognizer.AudioLevelUpdated += delegate(object sender, AudioLevelUpdatedEventArgs args) {
                    EmitLevel(args.AudioLevel);
                };
                recognizer.SpeechHypothesized += delegate(object sender, SpeechHypothesizedEventArgs args) {
                    var text = (args.Result.Text ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(text)) {
                        EmitResult(text, false);
                    }
                };
                recognizer.SpeechRecognized += delegate(object sender, SpeechRecognizedEventArgs args) {
                    var text = (args.Result.Text ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(text)) {
                        recognized = true;
                        EmitResult(text, true);
                    }
                    completed.Set();
                };
                recognizer.SpeechRecognitionRejected += delegate {
                    failed = true;
                    EmitError("No speech was detected. Try again.");
                    completed.Set();
                };
                recognizer.RecognizeCompleted += delegate(object sender, RecognizeCompletedEventArgs args) {
                    if (args.Error != null) {
                        failed = true;
                        EmitError("Speech recognition could not complete. Check Windows microphone privacy and your Speech language, then try again.");
                    } else if (!recognized && !failed && !args.Cancelled) {
                        failed = true;
                        EmitError("No speech was detected. Try again.");
                    }
                    completed.Set();
                };
                recognizer.SetInputToDefaultAudioDevice();
                recognizer.RecognizeAsync();
                completed.WaitOne();
                recognizer.RecognizeAsyncCancel();
            }
            return 0;
        } catch (Exception error) {
            EmitError("Could not start Windows Speech Recognition: " + error.Message);
            return 1;
        }
    }
}
'@
exit [CmdSpaceSpeech]::Run($env:CMDSPACE_SPEECH_LANGUAGE)
"#;
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn emit_error(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit("cmdspace:speech-error", message.into());
}

#[cfg(target_os = "macos")]
mod macos {
    use super::emit_error;
    use block2::RcBlock;
    use objc2::{rc::Retained, AnyThread};
    use objc2_avf_audio::{AVAudioEngine, AVAudioInputNode, AVAudioPCMBuffer, AVAudioTime};
    use objc2_foundation::{NSError, NSLocale, NSString};
    use objc2_speech::{
        SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognitionTask,
        SFSpeechRecognizer, SFSpeechRecognizerAuthorizationStatus,
    };
    use std::cell::{Cell, RefCell};
    use std::ptr::NonNull;
    use std::slice;
    use tauri::{AppHandle, Emitter};

    struct SpeechSession {
        id: u64,
        engine: Retained<AVAudioEngine>,
        input: Retained<AVAudioInputNode>,
        request: Retained<SFSpeechAudioBufferRecognitionRequest>,
        _recognizer: Retained<SFSpeechRecognizer>,
        _task: Retained<SFSpeechRecognitionTask>,
    }

    thread_local! {
        static SESSION: RefCell<Option<SpeechSession>> = const { RefCell::new(None) };
        static REQUEST_ID: Cell<u64> = const { Cell::new(0) };
    }

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
        let app_for_main = app.clone();
        app.run_on_main_thread(move || start_on_main(app_for_main, language))
            .map_err(|error| error.to_string())
    }

    pub fn stop(app: AppHandle) -> Result<(), String> {
        let app_for_main = app.clone();
        app.run_on_main_thread(move || finish_on_main(&app_for_main))
            .map_err(|error| error.to_string())
    }

    fn start_on_main(app: AppHandle, language: Option<String>) {
        let request_id = REQUEST_ID.with(|current| {
            let next = current.get().wrapping_add(1).max(1);
            current.set(next);
            next
        });
        cancel_session_on_main();
        let status = unsafe { SFSpeechRecognizer::authorizationStatus() };
        if status == SFSpeechRecognizerAuthorizationStatus::Authorized {
            begin_session(app, request_id, language);
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
                    begin_session(app_for_main, request_id, language_for_session);
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

    fn is_current_request(request_id: u64) -> bool {
        REQUEST_ID.with(|current| current.get() == request_id)
    }

    fn begin_session(app: AppHandle, request_id: u64, language: Option<String>) {
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
        let request_for_tap = request.clone();
        let app_for_levels = app.clone();
        let tap = RcBlock::new(
            move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| unsafe {
                request_for_tap.appendAudioPCMBuffer(buffer.as_ref());
                let _ =
                    app_for_levels.emit("cmdspace:speech-level", microphone_level(buffer.as_ref()));
            },
        );
        unsafe {
            input.installTapOnBus_bufferSize_format_block(0, 1_024, None, RcBlock::as_ptr(&tap));
        }

        let app_for_results = app.clone();
        let result_handler = RcBlock::new(
            move |result: *mut SFSpeechRecognitionResult, error: *mut NSError| {
                if !error.is_null() {
                    emit_error(
                        &app_for_results,
                        "Speech recognition could not complete. Check Dictation and your network, then try again.",
                    );
                    clear_session_for_result(&app_for_results, request_id);
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
                let _ = app_for_results.emit(
                    "cmdspace:speech-result",
                    serde_json::json!({ "text": transcript, "final": final_result }),
                );
                if final_result {
                    clear_session_for_result(&app_for_results, request_id);
                }
            },
        );
        let task = unsafe {
            recognizer.recognitionTaskWithRequest_resultHandler(&request, &result_handler)
        };

        unsafe { engine.prepare() };
        if let Err(error) = unsafe { engine.startAndReturnError() } {
            unsafe { input.removeTapOnBus(0) };
            emit_error(&app, format!("Could not start the microphone: {error}"));
            return;
        }

        SESSION.with(|session| {
            *session.borrow_mut() = Some(SpeechSession {
                id: request_id,
                engine,
                input,
                request,
                _recognizer: recognizer,
                _task: task,
            });
        });
        let _ = app.emit("cmdspace:speech-started", ());
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
        SESSION.with(|session| {
            if let Some(session) = session.borrow().as_ref() {
                unsafe {
                    session.input.removeTapOnBus(0);
                    session.engine.stop();
                    session.request.endAudio();
                    session._task.finish();
                }
            }
        });
        let _ = app.emit("cmdspace:speech-stopped", ());
    }

    fn cancel_session_on_main() {
        let stopped = SESSION.with(|session| session.borrow_mut().take());
        if let Some(session) = stopped {
            unsafe {
                session.input.removeTapOnBus(0);
                session.engine.stop();
                session.request.endAudio();
                session._task.cancel();
            }
        }
    }

    fn clear_session_for_result(app: &AppHandle, request_id: u64) {
        let app_for_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            SESSION.with(|session| {
                let should_clear = session
                    .borrow()
                    .as_ref()
                    .is_some_and(|active| active.id == request_id);
                if should_clear {
                    session.borrow_mut().take();
                }
            });
            let _ = app_for_main.emit("cmdspace:speech-stopped", ());
        });
    }
}
