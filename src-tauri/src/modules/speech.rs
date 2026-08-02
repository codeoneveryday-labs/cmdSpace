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
    use objc2::{rc::Retained, runtime::Bool, AnyThread};
    use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
    use objc2_avf_audio::{AVAudioEngine, AVAudioInputNode, AVAudioPCMBuffer, AVAudioTime};
    use objc2_foundation::{NSError, NSLocale, NSString};
    use objc2_speech::{
        SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognitionTask,
        SFSpeechRecognizer, SFSpeechRecognizerAuthorizationStatus,
    };
    use std::cell::{Cell, RefCell};
    use std::path::Path;
    use std::ptr::NonNull;
    use std::slice;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    const AUDIO_START_RETRY_DELAY: Duration = Duration::from_millis(350);
    const MAX_AUDIO_START_ATTEMPTS: u8 = 2;

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
        let request_id = REQUEST_ID.with(|current| {
            let next = current.get().wrapping_add(1).max(1);
            current.set(next);
            next
        });
        cancel_session_on_main();

        request_microphone_permission(app, request_id, language);
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

    fn microphone_permission_message() -> &'static str {
        "Microphone access is blocked. Allow cmdSpace in macOS Settings → Privacy & Security → Microphone, then try again."
    }

    fn is_current_request(request_id: u64) -> bool {
        REQUEST_ID.with(|current| current.get() == request_id)
    }

    fn invalidate_request_on_main() {
        REQUEST_ID.with(|current| {
            let next = current.get().wrapping_add(1).max(1);
            current.set(next);
        });
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
                let _ =
                    app_for_levels.emit("cmdspace:speech-level", microphone_level(buffer.as_ref()));
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
                    emit_error(&app_for_results, speech_error_message(error));
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

    fn should_retry_audio_start(attempt: u8) -> bool {
        attempt < MAX_AUDIO_START_ATTEMPTS
    }

    fn runs_from_macos_app_bundle() -> bool {
        std::env::current_exe()
            .ok()
            .is_some_and(|path| is_macos_app_bundle_executable(&path))
    }

    fn is_macos_app_bundle_executable(path: &Path) -> bool {
        path.parent()
            .zip(path.parent().and_then(Path::parent))
            .is_some_and(|(macos_dir, contents_dir)| {
                macos_dir.file_name().is_some_and(|name| name == "MacOS")
                    && contents_dir
                        .file_name()
                        .is_some_and(|name| name == "Contents")
            })
    }

    fn speech_error_message(error: &NSError) -> String {
        speech_error_message_parts(
            &error.domain().to_string(),
            error.code(),
            &error.localizedDescription().to_string(),
        )
    }

    fn speech_error_message_parts(domain: &str, code: isize, description: &str) -> String {
        match (domain, code) {
            ("kLSRErrorDomain", 102) => {
                "Speech assets for this language are not installed. Add the Dictation language in macOS Settings → Keyboard → Dictation, then try again.".to_string()
            }
            ("kLSRErrorDomain", 201) => {
                "Siri or Dictation is disabled. Enable Dictation in macOS Settings → Keyboard → Dictation, then try again.".to_string()
            }
            ("kLSRErrorDomain", 300) => {
                "macOS could not initialize speech recognition. Restart cmdSpace and verify Dictation is enabled.".to_string()
            }
            ("kAFAssistantErrorDomain", 1100) => {
                "A previous speech request is still stopping. Wait a moment, then try again.".to_string()
            }
            ("kAFAssistantErrorDomain", 1101 | 1107) => {
                "The macOS speech service was interrupted. Check your network and try again.".to_string()
            }
            ("kAFAssistantErrorDomain", 1110) => {
                "No speech was detected. Check the selected microphone and try again.".to_string()
            }
            ("kAFAssistantErrorDomain", 1700) => {
                "Speech Recognition permission is not authorized. Allow cmdSpace in macOS Settings → Privacy & Security → Speech Recognition.".to_string()
            }
            _ => format!(
                "Speech recognition could not complete. {description} ({domain} {code})"
            ),
        }
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
            dispose_session(session, true);
        }
    }

    fn clear_session_for_result(app: &AppHandle, request_id: u64) {
        let app_for_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            let completed = SESSION.with(|session| {
                let should_clear = session
                    .borrow()
                    .as_ref()
                    .is_some_and(|active| active.id == request_id);
                should_clear.then(|| session.borrow_mut().take()).flatten()
            });
            if let Some(session) = completed {
                dispose_session(session, false);
            }
            let _ = app_for_main.emit("cmdspace:speech-stopped", ());
        });
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
        use super::{
            invalidate_request_on_main, is_current_request, is_macos_app_bundle_executable,
            microphone_permission_message, should_retry_audio_start, speech_error_message_parts,
            REQUEST_ID,
        };
        use std::path::Path;

        #[test]
        fn retries_audio_start_once() {
            assert!(should_retry_audio_start(1));
            assert!(!should_retry_audio_start(2));
        }

        #[test]
        fn invalidated_request_cannot_restart_after_retry_delay() {
            let previous_request_id = REQUEST_ID.with(|current| {
                let previous = current.get();
                current.set(42);
                previous
            });
            assert!(is_current_request(42));

            invalidate_request_on_main();

            assert!(!is_current_request(42));
            REQUEST_ID.with(|current| current.set(previous_request_id));
        }

        #[test]
        fn only_runs_native_voice_from_a_macos_app_bundle() {
            assert!(is_macos_app_bundle_executable(Path::new(
                "/Applications/cmdSpace.app/Contents/MacOS/cmdspace"
            )));
            assert!(!is_macos_app_bundle_executable(Path::new(
                "/Users/me/dev/cmdspace/target/debug/cmdspace"
            )));
        }

        #[test]
        fn explains_the_dictation_setting_error() {
            assert_eq!(
                speech_error_message_parts("kLSRErrorDomain", 201, "ignored"),
                "Siri or Dictation is disabled. Enable Dictation in macOS Settings → Keyboard → Dictation, then try again."
            );
        }

        #[test]
        fn explains_how_to_restore_microphone_access() {
            assert_eq!(
                microphone_permission_message(),
                "Microphone access is blocked. Allow cmdSpace in macOS Settings → Privacy & Security → Microphone, then try again."
            );
        }
    }
}
