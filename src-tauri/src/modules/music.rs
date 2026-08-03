use std::{fs, path::PathBuf};

const MUSIC_CLI_SCRIPT: &str = include_str!("../../../scripts/music-cli.zsh");

fn state_file_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".cmdspace/music-cli.state"))
}

fn install_music_cli_script_at(path: &std::path::Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Music CLI script path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create Music CLI directory: {error}"))?;

    let temporary = path.with_extension("zsh.tmp");
    fs::write(&temporary, MUSIC_CLI_SCRIPT)
        .map_err(|error| format!("Failed to write Music CLI script: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Failed to secure Music CLI script: {error}"))?;
    }
    fs::rename(&temporary, path)
        .map_err(|error| format!("Failed to install Music CLI script: {error}"))
}

#[tauri::command]
pub fn install_music_cli_script() -> Result<(), String> {
    let path = dirs::home_dir()
        .ok_or_else(|| "Could not resolve the home directory".to_string())?
        .join(".cmdspace/music-cli.zsh");
    install_music_cli_script_at(&path)
}

fn state_pid(contents: &str) -> Option<u32> {
    contents.split_once('\t')?.0.trim().parse().ok()
}

#[cfg(unix)]
fn process_is_alive(pid: u32) -> bool {
    // Signal 0 checks process existence without changing its state.
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(not(unix))]
fn process_is_alive(_pid: u32) -> bool {
    false
}

#[tauri::command]
pub fn music_is_playing() -> bool {
    let Some(path) = state_file_path() else {
        return false;
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return false;
    };
    state_pid(&contents).is_some_and(process_is_alive)
}

#[cfg(test)]
mod tests {
    use super::{install_music_cli_script_at, state_pid};
    use std::fs;

    #[test]
    fn reads_the_worker_pid_from_music_state() {
        assert_eq!(state_pid("12345\tExample track\n"), Some(12345));
        assert_eq!(state_pid("missing title"), None);
        assert_eq!(state_pid("not-a-pid\tExample track"), None);
    }

    #[test]
    fn installs_the_bundled_music_cli_script() {
        let root =
            std::env::temp_dir().join(format!("cmdspace-music-cli-test-{}", std::process::id()));
        let path = root.join("nested/music-cli.zsh");
        let _ = fs::remove_dir_all(&root);

        install_music_cli_script_at(&path).expect("install script");
        let installed = fs::read_to_string(&path).expect("read installed script");
        assert!(installed.contains("mcli()"));
        assert!(installed.contains("if ! read -r query"));

        fs::remove_dir_all(root).expect("remove test directory");
    }
}
