use super::super::RemoteResponse;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

pub fn request_path(request: &[u8]) -> Option<&str> {
    let request = std::str::from_utf8(request).ok()?;
    let first_line = request.lines().next()?;
    first_line.split_whitespace().nth(1)
}

pub fn prepare_client_stream(stream: &TcpStream) -> std::io::Result<()> {
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    Ok(())
}

pub fn read_http_request(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut request = Vec::with_capacity(4096);
    let mut buf = [0_u8; 4096];
    loop {
        let n = stream.read(&mut buf)?;
        if n == 0 {
            break;
        }
        request.extend_from_slice(&buf[..n]);
        let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") else {
            if request.len() > 64 * 1024 {
                break;
            }
            continue;
        };
        let header_len = header_end + 4;
        let content_length = std::str::from_utf8(&request[..header_end])
            .ok()
            .and_then(|headers| {
                headers.lines().find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
            })
            .unwrap_or(0);
        if request.len() >= header_len.saturating_add(content_length) || request.len() > 64 * 1024 {
            break;
        }
    }
    Ok(request)
}

pub fn is_idle_client_read_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::WouldBlock
            | std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::Interrupted
    )
}

pub fn write_text_response(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len(),
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

pub fn write_binary_response(stream: &mut TcpStream, response: &RemoteResponse) {
    let headers = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        response.status,
        response.content_type,
        response.body.len(),
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(&response.body);
    let _ = stream.flush();
}

pub fn request_method(request: &[u8]) -> Option<&str> {
    std::str::from_utf8(request)
        .ok()?
        .lines()
        .next()?
        .split_whitespace()
        .next()
}

pub fn request_body(request: &[u8]) -> &str {
    std::str::from_utf8(request)
        .ok()
        .and_then(|value| value.split("\r\n\r\n").nth(1))
        .unwrap_or("")
}

pub fn query_value<'a>(path: &'a str, key: &str) -> Option<&'a str> {
    path.split('?').nth(1)?.split('&').find_map(|part| {
        let (name, value) = part.split_once('=')?;
        (name == key).then_some(value)
    })
}

pub fn percent_decode(value: &str) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(value.len());
    let raw = value.as_bytes();
    let mut index = 0;
    while index < raw.len() {
        if raw[index] == b'%' {
            if index + 2 >= raw.len() {
                return Err("invalid folder path encoding".to_string());
            }
            let hex = std::str::from_utf8(&raw[index + 1..index + 3])
                .map_err(|_| "invalid folder path encoding".to_string())?;
            let byte = u8::from_str_radix(hex, 16)
                .map_err(|_| "invalid folder path encoding".to_string())?;
            bytes.push(byte);
            index += 3;
        } else {
            bytes.push(raw[index]);
            index += 1;
        }
    }
    String::from_utf8(bytes).map_err(|_| "folder path is not valid UTF-8".to_string())
}

pub fn query_number(path: &str, key: &str) -> Option<u64> {
    query_value(path, key)?.parse().ok()
}

pub fn json_error(error: &str) -> String {
    serde_json::json!({"error": error}).to_string()
}

pub fn remote_session_id(path: &str, suffix: &str) -> Option<u64> {
    path.strip_prefix("/api/remote/session/")?
        .strip_suffix(suffix)?
        .parse()
        .ok()
}

pub fn desktop_session_id(session_id: u64) -> Result<u32, String> {
    u32::try_from(session_id).map_err(|_| "remote session does not exist".to_string())
}
