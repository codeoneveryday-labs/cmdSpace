use std::collections::HashSet;
use std::fs::{File, OpenOptions};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};

use crate::modules::workspace::{resolve_path, WorkspaceEnv};

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
                return Ok(CopyToNewTarget::Collision)
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
            return Ok(CopyToNewTarget::Collision)
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
            && super::is_same_or_descendant(&canonical_destination, &canonical_source)
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

#[cfg(test)]
mod tests {
    use super::*;

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
