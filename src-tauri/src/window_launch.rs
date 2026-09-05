use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, Manager, State};

#[derive(Default)]
pub(crate) struct LaunchTargets {
    pub(crate) directory: Option<PathBuf>,
    pub(crate) files: Vec<PathBuf>,
}

/// Launch targets are drained once so HMR and remounts cannot replay them.
#[derive(Default)]
pub(crate) struct LaunchDir(pub(crate) Mutex<LaunchTargets>);

pub(crate) fn get_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    state
        .0
        .lock()
        .expect("LaunchDir mutex poisoned")
        .directory
        .take()
        .map(path_string)
}

pub(crate) fn drain_open_files(
    state: State<'_, LaunchDir>,
    registry: State<'_, crate::modules::workspace::WorkspaceRegistry>,
) -> Vec<String> {
    let files = std::mem::take(&mut state.0.lock().expect("LaunchDir mutex poisoned").files);
    files
        .into_iter()
        .filter(|file| {
            file.parent()
                .is_some_and(|parent| registry.authorize(parent).is_ok())
        })
        .map(path_string)
        .collect()
}

pub(crate) fn parse_launch_dir() -> LaunchTargets {
    parse_launch_targets(std::env::args().skip(1))
}

pub(crate) fn queue_open_urls(app: &tauri::AppHandle, urls: &[tauri::Url]) {
    let files: Vec<_> = urls
        .iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter_map(canonical_file)
        .collect();
    if files.is_empty() {
        return;
    }
    let state = app.state::<LaunchDir>();
    let mut targets = state.0.lock().expect("LaunchDir mutex poisoned");
    add_open_files(&mut targets, files);
    drop(targets);
    let _ = app.emit("cmdspace:open-files", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn add_open_files(targets: &mut LaunchTargets, files: impl IntoIterator<Item = PathBuf>) {
    for file in files {
        if targets.directory.is_none() {
            targets.directory = file.parent().map(Path::to_path_buf);
        }
        if !targets.files.contains(&file) {
            targets.files.push(file);
        }
    }
}

fn parse_launch_targets(args: impl IntoIterator<Item = String>) -> LaunchTargets {
    let mut targets = LaunchTargets::default();
    for arg in args {
        if arg.starts_with('-') {
            continue;
        }
        let Ok(canon) = std::fs::canonicalize(&arg) else {
            continue;
        };
        if canon.is_dir() {
            targets.directory.get_or_insert(canon);
        } else if canon.is_file() {
            add_open_files(&mut targets, [canon]);
        }
    }
    targets
}

fn canonical_file(path: PathBuf) -> Option<PathBuf> {
    std::fs::canonicalize(path)
        .ok()
        .filter(|path| path.is_file())
}

fn path_string(path: PathBuf) -> String {
    let value = path.to_string_lossy();
    value.strip_prefix(r"\\?\").unwrap_or(&value).to_string()
}

#[cfg(test)]
mod tests {
    use super::{add_open_files, parse_launch_targets, LaunchTargets};
    use std::path::PathBuf;

    #[test]
    fn launch_targets_use_a_files_parent_as_the_workspace_directory() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("example.json");
        std::fs::write(&file, "{}").unwrap();

        let targets = parse_launch_targets([file.to_string_lossy().to_string()]);

        assert_eq!(targets.directory, Some(dir.path().canonicalize().unwrap()));
        assert_eq!(targets.files, vec![file.canonicalize().unwrap()]);
    }

    #[test]
    fn launch_targets_keep_an_explicit_directory_and_collect_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("example.ts");
        std::fs::write(&file, "export {};").unwrap();

        let targets = parse_launch_targets([
            dir.path().to_string_lossy().to_string(),
            file.to_string_lossy().to_string(),
        ]);

        assert_eq!(targets.directory, Some(dir.path().canonicalize().unwrap()));
        assert_eq!(targets.files, vec![file.canonicalize().unwrap()]);
    }

    #[test]
    fn open_event_targets_set_the_first_files_parent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("event.json");
        std::fs::write(&file, "{}").unwrap();
        let file = file.canonicalize().unwrap();
        let mut targets = LaunchTargets::default();

        add_open_files(&mut targets, [file.clone(), file.clone()]);

        assert_eq!(targets.directory, file.parent().map(PathBuf::from));
        assert_eq!(targets.files, vec![file]);
    }
}
