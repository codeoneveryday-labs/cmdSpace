use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use crate::modules::workspace::{resolve_path, WorkspaceEnv};

const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES: u64 = 65 * 1024 * 1024;

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

#[cfg(test)]
mod tests {
    use super::{image_mime_type, video_mime_type, ImageData};
    use std::path::Path;

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
