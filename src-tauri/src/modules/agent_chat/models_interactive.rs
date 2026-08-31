use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use super::AgentChatModel;

pub fn list_slash_models(
    program: &str,
    cwd: &Path,
    slash_command: &str,
    args: &[&str],
) -> Result<Vec<AgentChatModel>, String> {
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 40,
            cols: 160,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;
    let mut command = CommandBuilder::new(program);
    command.cwd(cwd);
    for arg in args {
        command.arg(arg);
    }
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    drop(pair.slave);
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let killer = child.clone_killer();
    let slash_command = slash_command.to_string();
    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    if tx.send(buf[..size].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(700));
        let _ = writer.write_all(format!("{slash_command}\n").as_bytes());
        let _ = writer.flush();
        thread::sleep(Duration::from_millis(2200));
        let _ = writer.write_all(&[3]);
        let _ = writer.flush();
    });
    let mut output = Vec::new();
    while let Ok(chunk) = rx.recv_timeout(Duration::from_millis(500)) {
        output.extend_from_slice(&chunk);
        if output.len() > 512 * 1024 {
            break;
        }
    }
    let mut killer = killer;
    let _ = killer.kill();
    let _ = child.wait();
    let text = String::from_utf8_lossy(&output);
    Ok(parse_interactive_models(&text))
}

pub fn parse_interactive_models(output: &str) -> Vec<AgentChatModel> {
    let mut models = Vec::new();
    for raw in output.lines() {
        let line = super::strip_ansi(raw).trim().to_string();
        let candidate = line.trim_start_matches(['❯', '>', '•', '*']).trim();
        let lower = candidate.to_ascii_lowercase();
        if candidate.is_empty()
            || lower.contains("warning")
            || lower.contains("term is set")
            || lower.contains("continue anyway")
            || lower.contains("[y/n]")
            || lower.contains("press ")
            || lower.contains("error")
            || lower.contains("model")
            || candidate.contains(':')
        {
            continue;
        }
        if candidate.len() < 2 || candidate.len() > 160 || candidate.split_whitespace().count() > 6
        {
            continue;
        }
        let id = candidate
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-")
            .to_ascii_lowercase();
        models.push(AgentChatModel {
            id,
            label: candidate.to_string(),
            description: None,
        });
    }
    models
}
