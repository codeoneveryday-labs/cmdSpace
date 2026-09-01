use super::super::remote_protocol::{RemoteProtocolDirectoryEntry, ServerMessage};
use super::device_commands::send_remote_device_event;
use super::runtime::{authorize_remote_cwd, resolve_mobile_workspace_cwd};
use std::{net::TcpStream, path::PathBuf};
use tungstenite::WebSocket;

pub(super) fn send_remote_device_directory(
    socket: &mut WebSocket<TcpStream>,
    device_id: &str,
    workspace_id: &str,
    requested: Option<&str>,
) -> Result<(), String> {
    let root = resolve_mobile_workspace_cwd(device_id, workspace_id)?;
    let root_path = PathBuf::from(&root);
    let path = requested.unwrap_or(&root);
    let current =
        std::fs::canonicalize(path).map_err(|error| format!("cannot read folder: {error}"))?;
    if !current.starts_with(&root_path) {
        return Err("directory must remain inside the workspace".to_string());
    }
    let mut entries = std::fs::read_dir(&current)
        .map_err(|error| format!("cannot read folder: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let kind = entry.file_type().ok()?;
            (kind.is_dir() || kind.is_file()).then(|| RemoteProtocolDirectoryEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry.path().to_string_lossy().into_owned(),
                is_directory: kind.is_dir(),
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| (!entry.is_directory, entry.name.to_lowercase()));
    send_remote_device_event(
        socket,
        ServerMessage::Directory {
            path: current.to_string_lossy().into_owned(),
            entries,
        },
    )
}

/// Mirrors the desktop remote folder picker while exposing only directories
/// that `authorize_remote_cwd` already permits to native paired devices.
pub(super) fn send_remote_device_folder_picker_directory(
    socket: &mut WebSocket<TcpStream>,
    requested: Option<&str>,
) -> Result<(), String> {
    let requested = requested
        .filter(|path| !path.trim().is_empty())
        .map(str::to_owned)
        .or_else(|| dirs::home_dir().map(|path| path.to_string_lossy().into_owned()))
        .ok_or_else(|| "home directory is unavailable".to_string())?;
    let current = authorize_remote_cwd(Some(&requested))?
        .ok_or_else(|| "folder is unavailable".to_string())?;
    let current_path = PathBuf::from(&current);
    let mut entries = std::fs::read_dir(&current_path)
        .map_err(|error| format!("cannot read folder: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_type().ok()?.is_dir().then_some(entry))
        .filter_map(|entry| {
            let path = authorize_remote_cwd(entry.path().to_str()).ok().flatten()?;
            Some(RemoteProtocolDirectoryEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path,
                is_directory: true,
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.name.to_lowercase());
    let parent = current_path
        .parent()
        .and_then(|parent| authorize_remote_cwd(parent.to_str()).ok().flatten());
    send_remote_device_event(
        socket,
        ServerMessage::FolderPickerDirectory {
            path: current,
            parent,
            entries,
        },
    )
}

pub(super) fn send_remote_device_file(
    socket: &mut WebSocket<TcpStream>,
    device_id: &str,
    workspace_id: &str,
    requested: &str,
) -> Result<(), String> {
    const MAX_FILE_BYTES: u64 = 1_048_576;
    let root = resolve_mobile_workspace_cwd(device_id, workspace_id)?;
    let path =
        std::fs::canonicalize(requested).map_err(|error| format!("cannot read file: {error}"))?;
    if !path.starts_with(PathBuf::from(root)) {
        return Err("file must remain inside the workspace".to_string());
    }
    let metadata =
        std::fs::metadata(&path).map_err(|error| format!("cannot read file: {error}"))?;
    if !metadata.is_file() {
        return Err("path is not a file".to_string());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err("file is too large to preview on mobile".to_string());
    }
    let content =
        std::fs::read_to_string(&path).map_err(|_| "file is not valid UTF-8 text".to_string())?;
    send_remote_device_event(
        socket,
        ServerMessage::FileContent {
            path: path.to_string_lossy().into_owned(),
            content,
        },
    )
}

pub(super) fn create_remote_directory(
    device_id: &str,
    workspace_id: &str,
    parent: &str,
    name: &str,
) -> Result<(), String> {
    if name.is_empty() || name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err("folder name is invalid".to_string());
    }
    let root = resolve_mobile_workspace_cwd(device_id, workspace_id)?;
    let parent =
        std::fs::canonicalize(parent).map_err(|error| format!("cannot read folder: {error}"))?;
    if !parent.starts_with(PathBuf::from(root)) {
        return Err("directory must remain inside the workspace".to_string());
    }
    std::fs::create_dir(parent.join(name)).map_err(|error| format!("cannot create folder: {error}"))
}
