use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use portable_pty::CommandBuilder;

const ZSHENV: &str = include_str!("scripts/zshenv.zsh");
const ZPROFILE: &str = include_str!("scripts/zprofile.zsh");
const ZLOGIN: &str = include_str!("scripts/zlogin.zsh");
const ZSHRC: &str = include_str!("scripts/zshrc.zsh");
const BASHRC: &str = include_str!("scripts/bashrc.bash");
const FISH_INIT: &str = include_str!("scripts/init.fish");

pub enum Shell {
    Zsh,
    Bash,
    Fish,
    Other,
}

impl Shell {
    pub fn detect(selected_shell: Option<&str>) -> Result<(Shell, String), String> {
        let selected_shell = selected_shell.unwrap_or("system");
        if selected_shell != "system" {
            let path = match selected_shell {
                "zsh" | "bash" | "fish" => resolve_shell_path(selected_shell).ok_or_else(|| {
                    format!("{selected_shell} is not installed or is not on PATH")
                })?,
                _ => return Err(format!("unsupported terminal shell: {selected_shell}")),
            };
            let shell = match selected_shell {
                "zsh" => Shell::Zsh,
                "bash" => Shell::Bash,
                "fish" => Shell::Fish,
                _ => unreachable!(),
            };
            return Ok((shell, path));
        }
        let path = login_shell()
            .or_else(|| std::env::var("SHELL").ok())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "/bin/zsh".into());
        let name = path.rsplit('/').next().unwrap_or("").to_string();
        let shell = match name.as_str() {
            "zsh" => Shell::Zsh,
            "bash" => Shell::Bash,
            "fish" => Shell::Fish,
            _ => Shell::Other,
        };
        Ok((shell, path))
    }
}

fn find_in_path(name: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.to_string_lossy().into_owned())
}

fn resolve_shell_path(name: &str) -> Option<String> {
    let system_path = match name {
        "zsh" => Some("/bin/zsh"),
        "bash" => Some("/bin/bash"),
        "fish" => None,
        _ => return None,
    };
    system_path
        .filter(|path| Path::new(path).is_file())
        .map(str::to_string)
        .or_else(|| find_in_path(name))
}

pub fn available_shells() -> Vec<String> {
    ["system", "zsh", "bash", "fish"]
        .into_iter()
        .filter(|shell| *shell == "system" || resolve_shell_path(shell).is_some())
        .map(str::to_string)
        .collect()
}

fn login_shell() -> Option<String> {
    use std::ffi::CStr;
    unsafe {
        let uid = libc::getuid();
        let pw = libc::getpwuid(uid);
        if pw.is_null() {
            return None;
        }
        let shell_ptr = (*pw).pw_shell;
        if shell_ptr.is_null() {
            return None;
        }
        CStr::from_ptr(shell_ptr).to_str().ok().map(String::from)
    }
}

pub fn build(cwd: Option<String>, selected_shell: Option<&str>) -> Result<CommandBuilder, String> {
    let (shell, shell_path) = Shell::detect(selected_shell)?;
    let mut cmd = CommandBuilder::new(&shell_path);
    super::apply_common(&mut cmd, cwd);

    match shell {
        Shell::Zsh => {
            match prepare_zdotdir() {
                Ok(zdotdir) => {
                    if let Ok(user_zd) = std::env::var("ZDOTDIR") {
                        if Path::new(&user_zd) != zdotdir.as_path() {
                            cmd.env("CMDSPACE_USER_ZDOTDIR", user_zd);
                        }
                    }
                    cmd.env("ZDOTDIR", &zdotdir);
                }
                Err(e) => log::warn!("zsh shell integration disabled: {e}"),
            }
            cmd.arg("-l");
        }
        Shell::Bash => {
            match prepare_bash_rcfile() {
                Ok(rc) => {
                    cmd.arg("--rcfile");
                    cmd.arg(rc);
                }
                Err(e) => log::warn!("bash shell integration disabled: {e}"),
            }
            cmd.arg("-i");
        }
        Shell::Fish => {
            if let Err(e) = prepare_fish_conf_d() {
                log::warn!("fish shell integration disabled: {e}");
            }
            cmd.arg("-i");
        }
        Shell::Other => {
            log::info!(
                "unsupported shell '{}', spawning without integration",
                shell_path
            );
        }
    }
    Ok(cmd)
}

fn integration_root() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "could not resolve home dir".to_string())?;
    let root = home
        .join(".cache")
        .join("cmdspace")
        .join("shell-integration");
    fs::create_dir_all(&root).map_err(|e| format!("create {}: {e}", root.display()))?;
    Ok(root)
}

fn prepare_zdotdir() -> Result<PathBuf, String> {
    let dir = integration_root()?.join("zsh");
    fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    write_if_changed(&dir.join(".zshenv"), ZSHENV)?;
    write_if_changed(&dir.join(".zprofile"), ZPROFILE)?;
    write_if_changed(&dir.join(".zshrc"), ZSHRC)?;
    write_if_changed(&dir.join(".zlogin"), ZLOGIN)?;
    Ok(dir)
}

fn prepare_bash_rcfile() -> Result<PathBuf, String> {
    let dir = integration_root()?.join("bash");
    fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let rc = dir.join("bashrc");
    write_if_changed(&rc, BASHRC)?;
    Ok(rc)
}

fn prepare_fish_conf_d() -> Result<(), String> {
    let home = dirs::home_dir().ok_or_else(|| "could not resolve home dir".to_string())?;
    let dir = home.join(".config").join("fish").join("conf.d");
    fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    write_if_changed(&dir.join("cmdspace.fish"), FISH_INIT)?;
    Ok(())
}

fn write_if_changed(path: &Path, content: &str) -> Result<(), String> {
    if let Ok(existing) = fs::read_to_string(path) {
        if existing == content {
            return Ok(());
        }
    }
    let mut tmp: OsString = path.as_os_str().to_owned();
    tmp.push(".__cmdspace_tmp__");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, content).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("rename {} -> {}: {e}", tmp.display(), path.display())
    })
}
