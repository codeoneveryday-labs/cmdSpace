use super::super::pty::PtyState;
use super::http::{desktop_session_id, percent_decode, query_value, write_text_response};
use super::runtime::authorize_remote_cwd;
use super::sessions::RemoteRuntime;
use serde::Serialize;
use std::fs;
use std::{
    io::Write,
    net::TcpStream,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};

pub(super) fn remote_folders_response(path: &str) -> Result<String, String> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct FolderEntry {
        name: String,
        path: String,
    }
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct FileEntry {
        name: String,
        path: String,
        parent: String,
    }
    let requested = query_value(path, "path")
        .map(percent_decode)
        .transpose()?
        .filter(|value| !value.trim().is_empty())
        .or_else(|| dirs::home_dir().map(|path| path.to_string_lossy().into_owned()))
        .ok_or_else(|| "home directory is unavailable".to_string())?;
    let current = authorize_remote_cwd(Some(&requested))?
        .ok_or_else(|| "folder is unavailable".to_string())?;
    let current_path = PathBuf::from(&current);
    let entries =
        fs::read_dir(&current_path).map_err(|error| format!("cannot read folder: {error}"))?;
    let mut folders = Vec::new();
    let mut files = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        let Some(file_type) = entry.file_type().ok() else {
            continue;
        };
        if file_type.is_dir() {
            let Some(folder_path) = authorize_remote_cwd(entry.path().to_str()).ok().flatten()
            else {
                continue;
            };
            folders.push(FolderEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: folder_path,
            });
        } else if file_type.is_file() {
            let Some(file_path) = fs::canonicalize(entry.path()).ok() else {
                continue;
            };
            files.push(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: file_path.to_string_lossy().into_owned(),
                parent: current.clone(),
            });
        }
    }
    folders.sort_by_key(|entry| entry.name.to_lowercase());
    files.sort_by_key(|entry| entry.name.to_lowercase());
    let parent = current_path
        .parent()
        .filter(|parent| authorize_remote_cwd(parent.to_str()).is_ok())
        .map(|parent| parent.to_string_lossy().into_owned());
    serde_json::to_string(&serde_json::json!({
        "current": current,
        "parent": parent,
        "folders": folders,
        "files": files,
    }))
    .map_err(|error| error.to_string())
}

pub(super) fn stream_remote_events(
    stream: &mut TcpStream,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    id: u64,
    after: u64,
) {
    let session = runtime
        .lock()
        .ok()
        .and_then(|guard| guard.sessions.get(&id).cloned());
    let Some(session) = session else {
        write_text_response(
            stream,
            "404 Not Found",
            "application/json",
            "{\"error\":\"session not found\"}",
        );
        return;
    };
    let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n");
    let mut cursor = after;
    loop {
        let mut output = session.output.lock().unwrap();
        while !output.chunks.iter().any(|(seq, _)| *seq > cursor) && !output.exited {
            let (next, timeout) = session
                .changed
                .wait_timeout(output, Duration::from_secs(15))
                .unwrap();
            output = next;
            if timeout.timed_out() {
                let _ = stream.write_all(b": heartbeat\n\n");
                let _ = stream.flush();
            }
        }
        let chunks: Vec<_> = output
            .chunks
            .iter()
            .filter(|(seq, _)| *seq > cursor)
            .cloned()
            .collect();
        let exited = output.exited;
        drop(output);
        for (seq, bytes) in chunks {
            cursor = seq;
            let hex = bytes
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>();
            if write!(stream, "id: {seq}\ndata: {hex}\n\n")
                .and_then(|_| stream.flush())
                .is_err()
            {
                return;
            }
        }
        if exited {
            let _ = stream.write_all(b"event: exit\ndata: {}\n\n");
            let _ = stream.flush();
            return;
        }
    }
}

pub(super) fn stream_pty_events(stream: &mut TcpStream, pty_state: &PtyState, id: u64) {
    let Ok(desktop_id) = desktop_session_id(id) else {
        return;
    };
    let Ok((receiver, replay)) = pty_state.subscribe_output(desktop_id) else {
        write_text_response(
            stream,
            "404 Not Found",
            "application/json",
            "{\"error\":\"desktop session not found\"}",
        );
        return;
    };
    let _ = stream.write_all(
        b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n",
    );
    for (sequence, bytes) in replay {
        let hex = bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        if write!(stream, "id: {sequence}\ndata: {hex}\n\n")
            .and_then(|_| stream.flush())
            .is_err()
        {
            return;
        }
    }
    loop {
        match receiver.recv_timeout(Duration::from_secs(15)) {
            Ok((sequence, bytes)) => {
                let hex = bytes
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>();
                if write!(stream, "id: {sequence}\ndata: {hex}\n\n")
                    .and_then(|_| stream.flush())
                    .is_err()
                {
                    return;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                if stream
                    .write_all(b": heartbeat\n\n")
                    .and_then(|_| stream.flush())
                    .is_err()
                {
                    return;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                let _ = stream.write_all(b"event: exit\ndata: {}\n\n");
                let _ = stream.flush();
                return;
            }
        }
    }
}

pub(super) fn pty_snapshot_response(pty_state: &PtyState, id: u64) -> Result<String, String> {
    let bytes = pty_state.output_snapshot(desktop_session_id(id)?)?;
    let mut output = String::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == 0x1b {
            index += 1;
            if index < bytes.len() && bytes[index] == b'[' {
                index += 1;
                while index < bytes.len() {
                    let final_byte = bytes[index];
                    index += 1;
                    if (0x40..=0x7e).contains(&final_byte) {
                        break;
                    }
                }
            } else if index < bytes.len() && bytes[index] == b']' {
                index += 1;
                while index < bytes.len() {
                    let control = bytes[index];
                    index += 1;
                    if control == 0x07 {
                        break;
                    }
                    if control == 0x1b && index < bytes.len() && bytes[index] == b'\\' {
                        index += 1;
                        break;
                    }
                }
            } else {
                index = index.saturating_add(1);
            }
            continue;
        }
        match byte {
            b'\n' => output.push('\n'),
            b'\r' => output.push('\n'),
            b'\t' => output.push('\t'),
            0x20..=0x7e => output.push(byte as char),
            _ => {}
        }
        index += 1;
    }
    serde_json::to_string(&serde_json::json!({ "output": output }))
        .map_err(|error| error.to_string())
}
