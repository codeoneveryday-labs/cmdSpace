#[cfg(windows)]
use super::super::pty::shell_init;
#[cfg(windows)]
use super::super::workspace::WorkspaceEnv;
use super::sessions::{RemoteOutput, RemoteTerminal, REMOTE_OUTPUT_LIMIT};
use std::{
    collections::VecDeque,
    io::Read,
    sync::{Arc, Condvar, Mutex},
    thread,
};

pub(super) fn spawn_remote_terminal(
    cwd: Option<String>,
    workspace_id: Option<String>,
    owner_device_id: Option<String>,
) -> Result<Arc<RemoteTerminal>, String> {
    let size = portable_pty::PtySize {
        rows: 40,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = portable_pty::native_pty_system()
        .openpty(size)
        .map_err(|e| e.to_string())?;
    let mut child = pair
        .slave
        .spawn_command(build_remote_shell_command(cwd.clone())?)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = Arc::new(Mutex::new(
        pair.master.take_writer().map_err(|e| e.to_string())?,
    ));
    let session = Arc::new(RemoteTerminal {
        cwd: cwd.clone(),
        workspace_id,
        owner_device_id,
        writer: Arc::clone(&writer),
        master: Mutex::new(pair.master),
        killer: Mutex::new(child.clone_killer()),
        output: Mutex::new(RemoteOutput {
            next_seq: 1,
            chunks: VecDeque::new(),
            exited: false,
        }),
        changed: Condvar::new(),
        native_controller: Mutex::new(None),
    });
    let output_session = Arc::clone(&session);
    thread::spawn(move || {
        let mut buf = [0_u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    let mut output = output_session.output.lock().unwrap();
                    let seq = output.next_seq;
                    output.next_seq = output.next_seq.saturating_add(1);
                    output.chunks.push_back((seq, buf[..size].to_vec()));
                    while output.chunks.len() > REMOTE_OUTPUT_LIMIT {
                        output.chunks.pop_front();
                    }
                    output_session.changed.notify_all();
                }
            }
        }
        let mut output = output_session.output.lock().unwrap();
        output.exited = true;
        output_session.changed.notify_all();
    });
    let wait_session = Arc::clone(&session);
    thread::spawn(move || {
        let _ = child.wait();
        let mut output = wait_session.output.lock().unwrap();
        output.exited = true;
        wait_session.changed.notify_all();
    });
    Ok(session)
}

/// Remote sessions deliberately use the user's normal login shell instead of
/// cmdSpace's desktop shell integration. The desktop integration emits OSC
/// markers for the local pane parser; forwarding those markers to a browser
/// terminal can corrupt the visible prompt on mobile renderers.
pub(super) fn build_remote_shell_command(
    cwd: Option<String>,
) -> Result<portable_pty::CommandBuilder, String> {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|path| std::path::Path::new(path).is_file())
            .unwrap_or_else(|| "/bin/zsh".to_string());
        let mut command = portable_pty::CommandBuilder::new(shell);
        command.arg("-l");
        command.arg("-i");
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command.env_remove("CMDSPACE_TERMINAL");
        command.env_remove("CMDSPACE_USER_ZDOTDIR");
        command.env_remove("ZDOTDIR");
        if let Some(cwd) = cwd {
            command.cwd(cwd);
        }
        Ok(command)
    }
    #[cfg(windows)]
    {
        shell_init::build_command(cwd, WorkspaceEnv::default(), None)
    }
}
