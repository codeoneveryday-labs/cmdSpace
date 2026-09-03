use crate::modules::workspace::WorkspaceEnv;

/// Names that always resolve to the Windows built-in shell even when the
/// Command Code CLI (`cmd`) isn't installed. A PATH hit on these must not be
/// reported as "installed".
#[cfg(windows)]
const WINDOWS_BUILTIN_SHELL_EXES: &[&str] = &["cmd.exe"];

fn path_entries() -> Vec<std::path::PathBuf> {
    std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default()
}

/// Extra directories that GUI-launched apps usually miss: macOS apps launched
/// from Finder/Dock inherit a minimal PATH that excludes Homebrew, and npm
/// global installs live under the user's home. PTY shells get these via
/// login/profile scripts, so this keeps detection in sync with the terminal.
#[cfg(unix)]
fn user_bin_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local").join("bin"));
        dirs.push(home.join(".npm-global").join("bin"));
        dirs.push(home.join(".cargo").join("bin"));
        dirs.push(home.join(".bun").join("bin"));
        dirs.push(home.join(".codex").join("bin"));
        dirs.push(home.join(".claude").join("local").join("bin"));
    }
    #[cfg(target_os = "macos")]
    {
        dirs.push(std::path::PathBuf::from("/opt/homebrew/bin"));
        dirs.push(std::path::PathBuf::from("/usr/local/bin"));
    }
    dirs
}

/// Ask a login shell what PATH the user would actually have in the terminal.
/// `sh -lc` runs path_helper on macOS (restores Homebrew); `$SHELL -lic` then
/// picks up `.zshrc`/`.bashrc` exports. Output is a colon-separated path list.
#[cfg(unix)]
fn login_shell_path_entries() -> Vec<std::path::PathBuf> {
    use std::process::Command;
    let probe = || -> Option<Vec<std::path::PathBuf>> {
        let sh = std::env::var("SHELL").ok().filter(|s| !s.is_empty())?;
        let login_out = Command::new("sh")
            .arg("-lc")
            .arg("printf '%s' \"$PATH\"")
            .output()
            .ok()?;
        if !login_out.status.success() {
            return None;
        }
        let login_path = String::from_utf8(login_out.stdout).ok()?;
        let mut entries: Vec<std::path::PathBuf> = std::env::split_paths(&login_path).collect();
        if sh.contains("zsh") || sh.contains("bash") {
            let interactive_out = Command::new(&sh)
                .arg("-lic")
                .arg("printf '%s' \"$PATH\"")
                .output()
                .ok()?;
            if interactive_out.status.success() {
                let interactive_path = String::from_utf8(interactive_out.stdout).ok()?;
                entries = std::env::split_paths(&interactive_path).collect();
            }
        }
        Some(entries)
    };
    probe().unwrap_or_default()
}

fn is_executable_file(path: &std::path::Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.is_file()
            && std::fs::metadata(path)
                .map(|m| m.permissions().mode() & 0o111 != 0)
                .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// True when `name` resolves to an executable file inside any of `dirs`,
/// trying each of `exts` (empty string = the bare name). Windows built-in
/// shell names are excluded so the Command Code CLI isn't conflated with the
/// OS shell.
fn resolvable_in_dirs(name: &str, dirs: &[std::path::PathBuf], exts: &[String]) -> bool {
    if name.trim().is_empty() {
        return false;
    }
    dirs.iter().any(|dir| {
        exts.iter().any(|ext| {
            let candidate = dir.join(format!("{name}{ext}"));
            if !is_executable_file(&candidate) {
                return false;
            }
            #[cfg(windows)]
            {
                let lower = candidate
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.to_ascii_lowercase())
                    .unwrap_or_default();
                if WINDOWS_BUILTIN_SHELL_EXES.contains(&lower.as_str()) {
                    return !is_windows_system32_path(&candidate);
                }
            }
            true
        })
    })
}

#[tauri::command]
pub fn check_agent_clis(
    names: Vec<String>,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<bool>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    if workspace.is_wsl() {
        #[cfg(windows)]
        {
            return check_agent_clis_wsl(&workspace, &names);
        }
        #[cfg(not(windows))]
        {
            // WSL env is meaningless off Windows; treat as local.
            let _ = &workspace;
        }
    }

    #[cfg(windows)]
    let mut path_exts: Vec<String> = std::env::var("PATHEXT")
        .map(|value| {
            value
                .split(';')
                .filter(|ext| !ext.is_empty())
                .map(|ext| ext.to_ascii_lowercase())
                .collect()
        })
        .unwrap_or_else(|_| vec![".exe".into(), ".cmd".into(), ".bat".into(), ".com".into()]);
    #[cfg(windows)]
    {
        path_exts.insert(0, String::new());
    }
    #[cfg(not(windows))]
    let path_exts: Vec<String> = vec![String::new()];

    #[allow(unused_mut)]
    let mut entries = path_entries();
    #[cfg(unix)]
    {
        entries.extend(user_bin_dirs());
        entries.extend(login_shell_path_entries());
    }
    Ok(names
        .iter()
        .map(|name| resolvable_in_dirs(name, &entries, &path_exts))
        .collect())
}

#[cfg(windows)]
fn is_windows_system32_path(path: &std::path::Path) -> bool {
    let system_root = std::env::var_os("SystemRoot")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Windows"));
    let system32 = system_root.join("System32");
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    path.starts_with(&system32)
}

#[cfg(windows)]
fn check_agent_clis_wsl(workspace: &WorkspaceEnv, names: &[String]) -> Result<Vec<bool>, String> {
    let WorkspaceEnv::Wsl { distro } = workspace else {
        return Ok(vec![false; names.len()]);
    };
    crate::modules::workspace::validate_wsl_distro_name(distro)?;
    let script = names
        .iter()
        .map(|name| {
            format!(
                "command -v '{}' >/dev/null 2>&1; printf '%s\\n' $?",
                name.replace('\'', "'\\''")
            )
        })
        .collect::<Vec<_>>()
        .join("");
    let out = crate::modules::workspace::wsl_exec_capture(distro, "sh", &["-c", &script])?;
    let flags: Vec<bool> = out.lines().map(|line| line.trim() == "0").collect();
    let mut flags = flags;
    flags.resize(names.len(), false);
    Ok(flags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_bin_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cmdspace-cli-probe-{tag}-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("unnamed")
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp bin dir");
        dir
    }

    fn cleanup(dir: &std::path::Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn user_bin_dirs_contains_home_local_bin() {
        let dirs = user_bin_dirs();
        let home = dirs::home_dir().expect("home dir");
        assert!(dirs.contains(&home.join(".local").join("bin")));
        assert!(dirs.contains(&home.join(".npm-global").join("bin")));
    }

    #[test]
    fn finds_bare_name_on_unix_style_path() {
        let dir = temp_bin_dir("bare");
        fs::write(dir.join("codex"), "#!/bin/sh\n").expect("write codex");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(dir.join("codex"))
                .expect("stat codex")
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(dir.join("codex"), perms).expect("chmod codex");
        }
        let dirs = vec![dir.clone()];
        let exts = vec![String::new()];
        assert!(resolvable_in_dirs("codex", &dirs, &exts));
        assert!(!resolvable_in_dirs("claude", &dirs, &exts));
        cleanup(&dir);
    }

    #[test]
    fn respects_pathext_style_extensions() {
        let dir = temp_bin_dir("ext");
        fs::write(dir.join("claude.exe"), "x").expect("write claude.exe");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(dir.join("claude.exe"))
                .expect("stat claude.exe")
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(dir.join("claude.exe"), perms).expect("chmod claude.exe");
        }
        let dirs = vec![dir.clone()];
        let exts = vec![
            String::new(),
            ".exe".to_string(),
            ".cmd".to_string(),
            ".bat".to_string(),
        ];
        assert!(resolvable_in_dirs("claude", &dirs, &exts));
        let exts_exe = vec![String::new(), ".exe".to_string()];
        assert!(!resolvable_in_dirs("codex", &dirs, &exts_exe));
        cleanup(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn system32_cmd_exe_is_rejected() {
        let candidate = std::path::PathBuf::from(r"C:\Windows\System32\cmd.exe");
        assert!(is_windows_system32_path(&candidate));
        let dirs = vec![std::path::PathBuf::from(r"C:\Windows\System32")];
        let exts = vec![String::new(), ".exe".to_string()];
        assert!(!resolvable_in_dirs("cmd", &dirs, &exts));
    }

    #[cfg(windows)]
    #[test]
    fn user_path_cmd_exe_is_accepted() {
        let candidate = std::path::PathBuf::from(r"C:\Users\me\AppData\Roaming\npm\cmd.exe");
        assert!(!is_windows_system32_path(&candidate));
        let dirs = vec![std::path::PathBuf::from(r"C:\Users\me\AppData\Roaming\npm")];
        let exts = vec![String::new(), ".exe".to_string()];
        assert!(resolvable_in_dirs("cmd", &dirs, &exts));
    }
}
