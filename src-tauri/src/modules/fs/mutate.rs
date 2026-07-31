use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::modules::workspace::{resolve_path, WorkspaceEnv};

static NEXT_TRASH_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedPath {
    pub path: String,
    pub token: String,
}

fn trash_entry_path(path: &Path, token: &str) -> PathBuf {
    path.parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".cmdspace-trash")
        .join(token)
}

fn next_trash_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!(
        "{}-{}",
        std::process::id(),
        nanos + u128::from(NEXT_TRASH_ID.fetch_add(1, Ordering::Relaxed))
    )
}

fn is_safe_trash_token(token: &str) -> bool {
    !token.is_empty()
        && token
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

/// Creates a new empty file. Fails if the file already exists.
#[tauri::command]
pub fn fs_create_file(path: String, workspace: Option<WorkspaceEnv>) -> Result<(), String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    if p.exists() {
        return Err(format!("already exists: {}", p.display()));
    }
    std::fs::write(&p, "").map_err(|e| {
        log::debug!("fs_create_file({}) failed: {e}", p.display());
        e.to_string()
    })
}

/// Creates a new directory. Fails if the directory already exists.
/// Parents are created as needed — matches the common "new folder" UX
/// where typing "a/b/c" creates the full chain.
#[tauri::command]
pub fn fs_create_dir(path: String, workspace: Option<WorkspaceEnv>) -> Result<(), String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    if p.exists() {
        return Err(format!("already exists: {}", p.display()));
    }
    std::fs::create_dir_all(&p).map_err(|e| {
        log::debug!("fs_create_dir({}) failed: {e}", p.display());
        e.to_string()
    })
}

/// Renames (or moves) a path. Refuses to overwrite an existing target.
#[tauri::command]
pub fn fs_rename(from: String, to: String, workspace: Option<WorkspaceEnv>) -> Result<(), String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let from_p = resolve_path(&from, &workspace);
    let to_p = resolve_path(&to, &workspace);
    if !from_p.exists() {
        return Err(format!("not found: {}", from_p.display()));
    }
    if to_p.exists() {
        return Err(format!("already exists: {}", to_p.display()));
    }
    std::fs::rename(&from_p, &to_p).map_err(|e| {
        log::debug!(
            "fs_rename({} -> {}) failed: {e}",
            from_p.display(),
            to_p.display()
        );
        e.to_string()
    })
}

/// Stages a file or directory in a hidden sibling directory so the frontend
/// can restore it with Cmd+Z. Callers are responsible for confirming the
/// destructive operation with the user.
#[tauri::command]
pub fn fs_delete(path: String, workspace: Option<WorkspaceEnv>) -> Result<DeletedPath, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    std::fs::symlink_metadata(&p).map_err(|e| {
        log::debug!("fs_delete stat({}) failed: {e}", p.display());
        e.to_string()
    })?;
    let trash_dir = p
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".cmdspace-trash");
    std::fs::create_dir_all(&trash_dir).map_err(|e| {
        log::warn!(
            "fs_delete create trash dir ({}) failed: {e}",
            trash_dir.display()
        );
        e.to_string()
    })?;

    for _ in 0..8 {
        let token = next_trash_token();
        let staged = trash_entry_path(&p, &token);
        match std::fs::rename(&p, &staged) {
            Ok(()) => {
                return Ok(DeletedPath { path, token });
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                log::warn!("fs_delete({}) failed: {error}", p.display());
                return Err(error.to_string());
            }
        }
    }

    Err("could not allocate a unique trash entry".to_string())
}

#[tauri::command]
pub fn fs_restore(
    path: String,
    token: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<(), String> {
    if !is_safe_trash_token(&token) {
        return Err("invalid trash token".to_string());
    }
    let workspace = WorkspaceEnv::from_option(workspace);
    let target = resolve_path(&path, &workspace);
    let staged = trash_entry_path(&target, &token);
    std::fs::symlink_metadata(&staged).map_err(|e| {
        log::debug!("fs_restore stat({}) failed: {e}", staged.display());
        e.to_string()
    })?;
    if std::fs::symlink_metadata(&target).is_ok() {
        return Err(format!(
            "restore target already exists: {}",
            target.display()
        ));
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&staged, &target).map_err(|e| {
        log::warn!(
            "fs_restore({} -> {}) failed: {e}",
            staged.display(),
            target.display()
        );
        e.to_string()
    })?;
    if let Some(trash_dir) = staged.parent() {
        let _ = std::fs::remove_dir(trash_dir);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trash_entry_path_is_a_hidden_sibling_of_the_deleted_path() {
        let path = std::path::Path::new("/workspace/src/app.ts");
        assert_eq!(
            trash_entry_path(path, "delete-123"),
            std::path::Path::new("/workspace/src/.cmdspace-trash/delete-123")
        );
    }

    #[test]
    fn rejects_trash_tokens_that_can_escape_the_staging_directory() {
        assert!(!is_safe_trash_token("../outside"));
        assert!(!is_safe_trash_token(""));
        assert!(is_safe_trash_token("delete-123_456"));
    }
}
