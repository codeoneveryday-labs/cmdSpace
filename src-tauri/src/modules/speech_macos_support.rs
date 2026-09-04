use std::path::Path;

use objc2_foundation::NSError;

pub(super) fn microphone_permission_message() -> &'static str {
    "Microphone access is blocked. Allow cmdSpace in macOS Settings → Privacy & Security → Microphone, then try again."
}

pub(super) fn should_retry_audio_start(attempt: u8) -> bool {
    attempt < 2
}

pub(super) fn should_recover_partial_transcript(
    is_no_speech_error: bool,
    transcript: &str,
) -> bool {
    is_no_speech_error && !transcript.trim().is_empty()
}

pub(super) fn runs_from_macos_app_bundle() -> bool {
    native_voice_runtime_available(
        std::env::current_exe().ok().as_deref(),
        cfg!(debug_assertions),
    )
}

fn native_voice_runtime_available(path: Option<&Path>, allow_debug_build: bool) -> bool {
    allow_debug_build || path.is_some_and(is_macos_app_bundle_executable)
}

pub(super) fn is_macos_app_bundle_executable(path: &Path) -> bool {
    path.parent()
        .zip(path.parent().and_then(Path::parent))
        .is_some_and(|(macos_dir, contents_dir)| {
            macos_dir.file_name().is_some_and(|name| name == "MacOS")
                && contents_dir
                    .file_name()
                    .is_some_and(|name| name == "Contents")
        })
}

pub(super) fn speech_error_message(error: &NSError) -> String {
    speech_error_message_parts(
        &error.domain().to_string(),
        error.code(),
        &error.localizedDescription().to_string(),
    )
}

pub(super) fn speech_error_message_parts(domain: &str, code: isize, description: &str) -> String {
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
        _ => format!("Speech recognition could not complete. {description} ({domain} {code})"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_macos_app_bundle_executable, microphone_permission_message,
        native_voice_runtime_available, should_recover_partial_transcript,
        should_retry_audio_start, speech_error_message_parts,
    };
    use std::path::Path;

    #[test]
    fn retries_audio_start_once() {
        assert!(should_retry_audio_start(1));
        assert!(!should_retry_audio_start(2));
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
    fn allows_debug_executables_when_their_info_plist_is_embedded() {
        let dev_executable = Path::new("/Users/me/dev/cmdspace/target/debug/cmdspace");
        assert!(native_voice_runtime_available(Some(dev_executable), true));
        assert!(!native_voice_runtime_available(Some(dev_executable), false));
    }

    #[test]
    fn recovers_partial_text_only_for_a_no_speech_error() {
        assert!(should_recover_partial_transcript(true, "open terminal"));
        assert!(!should_recover_partial_transcript(true, "  "));
        assert!(!should_recover_partial_transcript(false, "open terminal"));
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
