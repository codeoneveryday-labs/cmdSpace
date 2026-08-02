use std::io::Write;
use std::path::Path;
use std::time::UNIX_EPOCH;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use tauri::Emitter;
use tempfile::NamedTempFile;

use crate::modules::workspace::{resolve_path, WorkspaceEnv};

const MAX_READ_BYTES: u64 = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES: u64 = 65 * 1024 * 1024;
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ReadResult {
    Text {
        content: String,
        size: u64,
    },
    Binary {
        size: u64,
    },
    /// File exceeds MAX_READ_BYTES. UI decides whether to offer "open anyway".
    TooLarge {
        size: u64,
        limit: u64,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    pub data_url: String,
    pub size: u64,
}

fn image_mime_type(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn video_mime_type(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "mp4" | "m4v" => Some("video/mp4"),
        "webm" => Some("video/webm"),
        "ogv" => Some("video/ogg"),
        "mov" => Some("video/quicktime"),
        _ => None,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StatKind {
    File,
    Dir,
    Symlink,
}

#[derive(Serialize)]
pub struct FileStat {
    pub size: u64,
    pub mtime: u64,
    pub kind: StatKind,
}

#[tauri::command]
pub fn fs_read_file(path: String, workspace: Option<WorkspaceEnv>) -> Result<ReadResult, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    let meta = std::fs::metadata(&p).map_err(|e| {
        log::debug!("fs_read_file stat({}) failed: {e}", p.display());
        e.to_string()
    })?;

    let size = meta.len();
    if size > MAX_READ_BYTES {
        return Ok(ReadResult::TooLarge {
            size,
            limit: MAX_READ_BYTES,
        });
    }

    let bytes = std::fs::read(&p).map_err(|e| {
        log::debug!("fs_read_file read({}) failed: {e}", p.display());
        e.to_string()
    })?;

    // Null-byte sniff on the first chunk. Not perfect (misses UTF-16 BOM
    // cases) but catches the common "this is a PNG" mistake cheaply.
    let sniff_len = bytes.len().min(BINARY_SNIFF_BYTES);
    if bytes[..sniff_len].contains(&0) {
        return Ok(ReadResult::Binary { size });
    }

    match String::from_utf8(bytes) {
        Ok(content) => Ok(ReadResult::Text { content, size }),
        Err(_) => Ok(ReadResult::Binary { size }),
    }
}

#[tauri::command]
pub fn fs_read_image(path: String, workspace: Option<WorkspaceEnv>) -> Result<ImageData, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let image_path = resolve_path(&path, &workspace);
    let mime = image_mime_type(&image_path)
        .ok_or_else(|| format!("unsupported image type: {}", image_path.display()))?;
    let size = std::fs::metadata(&image_path)
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_IMAGE_BYTES {
        return Err(format!(
            "image exceeds the {} MB preview limit",
            MAX_IMAGE_BYTES / 1024 / 1024
        ));
    }
    let bytes = std::fs::read(&image_path).map_err(|error| error.to_string())?;
    Ok(ImageData {
        data_url: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        size,
    })
}

#[tauri::command]
pub fn fs_read_video(path: String, workspace: Option<WorkspaceEnv>) -> Result<ImageData, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let video_path = resolve_path(&path, &workspace);
    let mime = video_mime_type(&video_path)
        .ok_or_else(|| format!("unsupported video type: {}", video_path.display()))?;
    let size = std::fs::metadata(&video_path)
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_VIDEO_BYTES {
        return Err(format!(
            "video exceeds the {} MB preview limit",
            MAX_VIDEO_BYTES / 1024 / 1024
        ));
    }
    let bytes = std::fs::read(&video_path).map_err(|error| error.to_string())?;
    Ok(ImageData {
        data_url: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        size,
    })
}

#[derive(Serialize, Clone)]
struct FileWrittenEvent {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

/// Atomic write via O_EXCL tempfile in the target's parent, then rename.
/// The random suffix is what blocks pre-staged symlink attacks.
fn write_atomic(target: &Path, content: &[u8]) -> std::io::Result<()> {
    let parent = target.parent().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "path has no parent")
    })?;
    let mut tmp = NamedTempFile::new_in(parent)?;
    tmp.as_file_mut().write_all(content)?;
    tmp.as_file_mut().sync_all()?;
    tmp.persist(target).map_err(|e| e.error)?;
    Ok(())
}

#[tauri::command]
pub fn fs_write_file(
    path: String,
    content: String,
    workspace: Option<WorkspaceEnv>,
    source: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let target = resolve_path(&path, &workspace);

    write_atomic(&target, content.as_bytes()).map_err(|e| {
        log::warn!("fs_write_file({}) failed: {e}", target.display());
        e.to_string()
    })?;

    let _ = app.emit(
        "fs:file-written",
        FileWrittenEvent {
            path: path.clone(),
            source,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn fs_canonicalize(path: String, workspace: Option<WorkspaceEnv>) -> Result<String, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    let canon = std::fs::canonicalize(&p).map_err(|e| e.to_string())?;
    // Strip the Windows `\\?\` extended-length prefix so the frontend's
    // path comparator sees the same form regardless of OS.
    let s = canon.to_string_lossy().to_string();
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    Ok(s.replace('\\', "/"))
}

#[tauri::command]
pub fn fs_stat(path: String, workspace: Option<WorkspaceEnv>) -> Result<FileStat, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    let meta = std::fs::metadata(&p).map_err(|e| e.to_string())?;
    let kind = if meta.is_dir() {
        StatKind::Dir
    } else if meta.file_type().is_symlink() {
        StatKind::Symlink
    } else {
        StatKind::File
    };
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(FileStat {
        size: meta.len(),
        mtime,
        kind,
    })
}

#[tauri::command]
pub fn select_folder() -> Option<String> {
    let dir = rfd::FileDialog::new().pick_folder();
    dir.map(|p| p.to_string_lossy().to_string())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;

    #[test]
    fn overwrites_existing_target() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("note.txt");
        std::fs::write(&target, b"old").unwrap();
        write_atomic(&target, b"new").unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"new");
    }

    #[test]
    fn does_not_follow_legacy_staging_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("outside.txt");
        std::fs::write(&outside, b"untouched").unwrap();

        let target = dir.path().join("note.txt");
        // Pre-stage a symlink at the legacy deterministic staging path.
        let legacy = dir.path().join(".note.txt.cmdspace.tmp");
        symlink(&outside, &legacy).unwrap();

        write_atomic(&target, b"payload").unwrap();

        assert_eq!(std::fs::read(&target).unwrap(), b"payload");
        // The pre-staged symlink target must not have been written through.
        assert_eq!(std::fs::read(&outside).unwrap(), b"untouched");
    }

    #[test]
    fn recognizes_supported_image_extensions_case_insensitively() {
        assert_eq!(
            image_mime_type(Path::new("poster.JPEG")),
            Some("image/jpeg")
        );
        assert_eq!(
            image_mime_type(Path::new("diagram.svg")),
            Some("image/svg+xml")
        );
        assert_eq!(image_mime_type(Path::new("archive.zip")), None);
    }

    #[test]
    fn recognizes_supported_video_extensions_case_insensitively() {
        assert_eq!(video_mime_type(Path::new("clip.MP4")), Some("video/mp4"));
        assert_eq!(video_mime_type(Path::new("clip.webm")), Some("video/webm"));
        assert_eq!(video_mime_type(Path::new("clip.mkv")), None);
    }

    #[test]
    fn serializes_preview_data_with_camel_case_keys() {
        let preview = ImageData {
            data_url: "data:image/png;base64,AA==".to_string(),
            size: 4,
        };

        let value = serde_json::to_value(preview).unwrap();
        assert_eq!(value["dataUrl"], "data:image/png;base64,AA==");
        assert!(value.get("data_url").is_none());
    }
}
