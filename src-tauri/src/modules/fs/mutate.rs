use std::collections::HashSet;
use std::fs::{File, OpenOptions};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD, Engine};
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

fn is_same_or_descendant(candidate: &Path, ancestor: &Path) -> bool {
    candidate == ancestor || candidate.starts_with(ancestor)
}

fn file_name(path: &Path) -> Result<&std::ffi::OsStr, String> {
    path.file_name()
        .filter(|name| !name.is_empty())
        .ok_or_else(|| format!("path has no file name: {}", path.display()))
}

fn copy_path(source: &Path, target: &Path) -> std::io::Result<()> {
    let metadata = std::fs::symlink_metadata(source)?;
    if metadata.file_type().is_symlink() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("refusing to import symlink: {}", source.display()),
        ));
    }
    if metadata.is_file() {
        let mut source_file = File::open(source)?;
        let mut target_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(target)?;
        copy(&mut source_file, &mut target_file)?;
        target_file.sync_all()?;
        std::fs::set_permissions(target, metadata.permissions())?;
        return Ok(());
    }
    if !metadata.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("unsupported import type: {}", source.display()),
        ));
    }

    std::fs::create_dir(target)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        copy_path(&entry.path(), &target.join(entry.file_name()))?;
    }
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
enum CopyToNewTarget {
    Copied,
    Collision,
}

fn copy_path_to_new_target(source: &Path, target: &Path) -> std::io::Result<CopyToNewTarget> {
    let metadata = std::fs::symlink_metadata(source)?;
    if metadata.file_type().is_symlink() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("refusing to import symlink: {}", source.display()),
        ));
    }
    if metadata.is_file() {
        let mut source_file = File::open(source)?;
        let mut target_file = match OpenOptions::new().write(true).create_new(true).open(target) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                return Ok(CopyToNewTarget::Collision);
            }
            Err(error) => return Err(error),
        };
        copy(&mut source_file, &mut target_file)?;
        target_file.sync_all()?;
        std::fs::set_permissions(target, metadata.permissions())?;
        return Ok(CopyToNewTarget::Copied);
    }
    if !metadata.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("unsupported import type: {}", source.display()),
        ));
    }

    match std::fs::create_dir(target) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            return Ok(CopyToNewTarget::Collision);
        }
        Err(error) => return Err(error),
    }
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        copy_path(&entry.path(), &target.join(entry.file_name()))?;
    }
    Ok(CopyToNewTarget::Copied)
}

fn available_copy_target(
    source: &Path,
    destination: &Path,
    reserved: &HashSet<PathBuf>,
) -> Result<PathBuf, String> {
    let name = file_name(source)?;
    let target = destination.join(name);
    if !target.exists() && !reserved.contains(&target) {
        return Ok(target);
    }

    let source_name = Path::new(name);
    let (stem, extension) = if source.is_dir() {
        (name, None)
    } else {
        (
            source_name.file_stem().unwrap_or(name),
            source_name.extension(),
        )
    };
    for copy_number in 1_u32.. {
        let mut candidate_name = stem.to_os_string();
        if copy_number == 1 {
            candidate_name.push(" copy");
        } else {
            candidate_name.push(format!(" copy {copy_number}"));
        }
        if let Some(extension) = extension {
            candidate_name.push(".");
            candidate_name.push(extension);
        }
        let candidate = destination.join(candidate_name);
        if !candidate.exists() && !reserved.contains(&candidate) {
            return Ok(candidate);
        }
    }
    unreachable!("copy suffix counter is unbounded")
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
    if from_p.is_dir() && is_same_or_descendant(&to_p, &from_p) {
        return Err("cannot move a directory into itself".to_string());
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

/// Copies files or directories dropped from outside the app into a workspace
/// directory. Existing files are never overwritten and symlinks are rejected.
#[tauri::command]
pub fn fs_import_paths(
    sources: Vec<String>,
    destination: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<String>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let destination = resolve_path(&destination, &workspace);
    if !destination.is_dir() {
        return Err(format!(
            "import destination is not a directory: {}",
            destination.display()
        ));
    }

    let canonical_destination = std::fs::canonicalize(&destination).map_err(|e| e.to_string())?;
    let mut import_sources = Vec::with_capacity(sources.len());
    for source in sources {
        let source = PathBuf::from(source);
        let canonical_source = std::fs::canonicalize(&source).map_err(|e| e.to_string())?;
        if canonical_source.is_dir()
            && is_same_or_descendant(&canonical_destination, &canonical_source)
        {
            return Err("cannot copy a directory into itself or its descendant".to_string());
        }
        import_sources.push(source);
    }

    let mut reserved = HashSet::new();
    let mut imported = Vec::with_capacity(import_sources.len());
    for source in import_sources {
        loop {
            let target = available_copy_target(&source, &destination, &reserved)?;
            reserved.insert(target.clone());
            match copy_path_to_new_target(&source, &target) {
                Ok(CopyToNewTarget::Collision) => continue,
                Ok(CopyToNewTarget::Copied) => {
                    imported.push(target.to_string_lossy().replace('\\', "/"));
                    break;
                }
                Err(error) => {
                    let _ = if target.is_dir() {
                        std::fs::remove_dir_all(&target)
                    } else {
                        std::fs::remove_file(&target)
                    };
                    return Err(error.to_string());
                }
            }
        }
    }
    Ok(imported)
}

/// Stores a browser clipboard file in a workspace directory without allowing
/// a pasted name to escape that directory or overwrite an existing path.
#[tauri::command]
pub fn fs_import_clipboard_file(
    name: String,
    data_base64: String,
    destination: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<String, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let destination = resolve_path(&destination, &workspace);
    if !destination.is_dir() {
        return Err(format!(
            "import destination is not a directory: {}",
            destination.display()
        ));
    }
    let name = Path::new(&name);
    if name.components().count() != 1 || name.as_os_str().is_empty() {
        return Err("clipboard file name must not contain a path".to_string());
    }
    let target = destination.join(name);
    let bytes = STANDARD
        .decode(data_base64)
        .map_err(|error| error.to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().replace('\\', "/"))
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn fs_clipboard_paths() -> Result<Vec<String>, String> {
    use objc2::{rc::autoreleasepool, ClassType};
    use objc2_app_kit::{NSPasteboard, NSPasteboardURLReadingFileURLsOnlyKey};
    use objc2_foundation::{NSArray, NSDictionary, NSNumber, NSURL};

    autoreleasepool(|_| {
        let classes = NSArray::from_slice(&[NSURL::class()]);
        let options = NSDictionary::from_slices(
            &[unsafe { NSPasteboardURLReadingFileURLsOnlyKey }],
            &[NSNumber::new_bool(true).as_ref()],
        );
        let objects = unsafe {
            NSPasteboard::generalPasteboard()
                .readObjectsForClasses_options(&classes, Some(&options))
        };
        Ok(objects
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.downcast::<NSURL>().ok().and_then(|url| {
                            url.path().map(|path| path.to_string().replace('\\', "/"))
                        })
                    })
                    .collect()
            })
            .unwrap_or_default())
    })
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn fs_clipboard_paths() -> Result<Vec<String>, String> {
    Ok(Vec::new())
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

    #[test]
    fn copies_a_directory_tree_without_following_symlinks() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        let source = source_root.path().join("assets");
        std::fs::create_dir_all(source.join("nested")).unwrap();
        std::fs::write(source.join("nested/icon.txt"), "icon").unwrap();

        let target = destination_root.path().join("assets");
        copy_path(&source, &target).unwrap();

        assert_eq!(
            std::fs::read_to_string(target.join("nested/icon.txt")).unwrap(),
            "icon"
        );
    }

    #[test]
    fn copy_path_refuses_to_overwrite_a_file_created_by_a_racing_writer() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        let source = source_root.path().join("note.txt");
        let target = destination_root.path().join("note.txt");
        std::fs::write(&source, "new").unwrap();
        std::fs::write(&target, "existing").unwrap();

        let error = copy_path(&source, &target).unwrap_err();

        assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
        assert_eq!(std::fs::read_to_string(target).unwrap(), "existing");
    }

    #[test]
    fn copy_to_new_target_reports_a_collision_without_removing_the_existing_file() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        let source = source_root.path().join("note.txt");
        let target = destination_root.path().join("note copy.txt");
        std::fs::write(&source, "new").unwrap();
        std::fs::write(&target, "racing writer").unwrap();

        let result = copy_path_to_new_target(&source, &target).unwrap();

        assert_eq!(result, CopyToNewTarget::Collision);
        assert_eq!(std::fs::read_to_string(target).unwrap(), "racing writer");
    }

    #[test]
    fn rejects_moves_into_a_directory_descendant() {
        let source = Path::new("/workspace/assets");
        let destination = Path::new("/workspace/assets/icons");

        assert!(is_same_or_descendant(destination, source));
    }

    #[test]
    fn clipboard_import_requires_an_existing_directory() {
        let temp = tempfile::tempdir().unwrap();
        let missing_destination = temp.path().join("missing").to_string_lossy().into_owned();

        let error = fs_import_clipboard_file(
            "note.txt".to_string(),
            STANDARD.encode("note"),
            missing_destination,
            None,
        )
        .unwrap_err();

        assert!(error.contains("import destination is not a directory"));
    }

    #[test]
    fn path_import_uses_a_copy_suffix_instead_of_overwriting() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        let source = source_root.path().join("note.txt");
        std::fs::write(&source, "new").unwrap();
        std::fs::write(destination_root.path().join("note.txt"), "existing").unwrap();

        let imported = fs_import_paths(
            vec![source.to_string_lossy().into_owned()],
            destination_root.path().to_string_lossy().into_owned(),
            None,
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(destination_root.path().join("note.txt")).unwrap(),
            "existing"
        );
        assert_eq!(
            std::fs::read_to_string(destination_root.path().join("note copy.txt")).unwrap(),
            "new"
        );
        assert_eq!(
            imported,
            vec![destination_root
                .path()
                .join("note copy.txt")
                .to_string_lossy()
                .replace('\\', "/")]
        );
    }

    #[test]
    fn path_import_rejects_copying_a_directory_into_its_descendant() {
        let source_root = tempfile::tempdir().unwrap();
        let source = source_root.path().join("assets");
        let destination = source.join("nested");
        std::fs::create_dir_all(&destination).unwrap();

        let error = fs_import_paths(
            vec![source.to_string_lossy().into_owned()],
            destination.to_string_lossy().into_owned(),
            None,
        )
        .unwrap_err();

        assert!(error.contains("cannot copy a directory into itself"));
    }
}
