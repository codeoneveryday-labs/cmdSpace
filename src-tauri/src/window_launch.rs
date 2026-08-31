use std::sync::Mutex;

use tauri::State;

/// Drained on first read so HMR / re-mounts can't replay the launch dir.
#[derive(Default)]
pub(crate) struct LaunchDir(pub(crate) Mutex<Option<String>>);

pub(crate) fn get_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    state.0.lock().expect("LaunchDir mutex poisoned").take()
}

pub(crate) fn parse_launch_dir() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let Ok(canon) = std::fs::canonicalize(&arg) else {
            continue;
        };
        if !canon.is_dir() {
            continue;
        }
        let s = canon.to_string_lossy();
        return Some(s.strip_prefix(r"\\?\").unwrap_or(&s).to_string());
    }
    None
}
