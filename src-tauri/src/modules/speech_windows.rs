use super::{emit_error, windows_lifecycle::SpeechLifecycle};
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock,
    },
};
use tauri::{AppHandle, Emitter};

static SESSION: OnceLock<Mutex<SpeechLifecycle<SpeechSession>>> = OnceLock::new();
static REQUEST_ID: AtomicU64 = AtomicU64::new(0);

struct SpeechSession {
    child: Child,
}

fn session() -> &'static Mutex<SpeechLifecycle<SpeechSession>> {
    SESSION.get_or_init(|| Mutex::new(SpeechLifecycle::new()))
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

    let replaced = {
        let mut active = session()
            .lock()
            .map_err(|_| "Windows Speech Recognition session lock was poisoned.".to_string())?;
        active.replace_session(id, SpeechSession { child })
    };
    if let Some(previous) = replaced {
        stop_session(previous);
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
    let previous = session()
        .lock()
        .ok()
        .and_then(|mut active| active.take_active_session());
    if let Some(previous) = previous {
        stop_session(previous);
    }
}

fn stop_active_session() {
    cancel_active_session();
}

fn stop_session(mut session: SpeechSession) {
    let _ = session.child.kill();
    let _ = session.child.wait();
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
                let _ = emit_if_current(id, || app.emit("cmdspace:speech-level", level));
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
                let emitted = emit_if_current(id, || {
                    app.emit(
                        "cmdspace:speech-result",
                        serde_json::json!({ "text": text, "final": final_result }),
                    )
                });
                if final_result && emitted.is_some() {
                    saw_result = true;
                }
            }
            Some("error") => {
                let message = event
                    .get("message")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("Windows Speech Recognition could not complete. Try again.");
                if emit_if_current(id, || emit_error(&app, message)).is_some() {
                    saw_error = true;
                }
            }
            _ => {}
        }
    }

    finish_session(app, id, saw_result, saw_error);
}

fn emit_if_current<Output>(id: u64, emit: impl FnOnce() -> Output) -> Option<Output> {
    let active = session().lock().ok()?;
    active.emit_if_current(id, emit)
}

fn finish_session(app: AppHandle, id: u64, saw_result: bool, saw_error: bool) {
    let Ok(mut active) = session().lock() else {
        return;
    };
    let _ = active.finish_if_current(id, |session| {
        drop(session);
        if !saw_result && !saw_error {
            emit_error(&app, "No speech was detected. Try again.");
        }
        let _ = app.emit("cmdspace:speech-stopped", ());
    });
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
