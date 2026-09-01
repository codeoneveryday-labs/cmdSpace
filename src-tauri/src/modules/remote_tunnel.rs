use serde::Serialize;
use std::{
    ffi::OsString,
    io::{BufRead, BufReader, Read},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

#[cfg(all(test, unix))]
use std::path::Path;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TunnelState {
    Starting,
    Ready,
    Degraded,
    Error,
    #[default]
    Stopped,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct TunnelSnapshot {
    pub state: TunnelState,
    pub public_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub(crate) struct TunnelCommand {
    program: OsString,
    args: Vec<OsString>,
    requires_origin_registration: bool,
}

pub struct LocalhostRunTunnel {
    stop_requested: Arc<AtomicBool>,
    snapshot: Arc<Mutex<TunnelSnapshot>>,
    supervisor: Option<JoinHandle<()>>,
}

#[path = "remote_tunnel_provider.rs"]
mod provider;
pub(crate) use provider::{
    cloudflared_origin_registered, cloudflared_origin_unregistered, extract_public_https_url,
};
// Keep provider test helpers at their historical module path.
#[allow(unused_imports)]
pub(crate) use provider::{
    cloudflared_quick_tunnel_args, localhost_run_ssh_args, public_tunnel_host,
};
use provider::{public_tunnel_command, public_tunnel_is_resolvable};

impl LocalhostRunTunnel {
    pub fn start(local_port: u16) -> Result<Self, String> {
        Self::start_command(public_tunnel_command(local_port))
    }

    #[cfg(all(test, unix))]
    pub(crate) fn start_command_for_test(
        program: &Path,
        args: Vec<OsString>,
    ) -> Result<Self, String> {
        Self::start_command(TunnelCommand {
            program: program.as_os_str().to_owned(),
            args,
            requires_origin_registration: false,
        })
    }

    fn start_command(command: TunnelCommand) -> Result<Self, String> {
        let stop_requested = Arc::new(AtomicBool::new(false));
        let snapshot = Arc::new(Mutex::new(TunnelSnapshot {
            state: TunnelState::Starting,
            public_url: None,
            error: None,
        }));
        let thread_stop = Arc::clone(&stop_requested);
        let thread_snapshot = Arc::clone(&snapshot);
        let supervisor = thread::Builder::new()
            .name("cmdspace-localhost-run-tunnel".to_string())
            .spawn(move || supervise(command, thread_stop, thread_snapshot))
            .map_err(|error| format!("remote tunnel supervisor failed: {error}"))?;

        Ok(Self {
            stop_requested,
            snapshot,
            supervisor: Some(supervisor),
        })
    }

    pub fn snapshot(&self) -> TunnelSnapshot {
        self.snapshot
            .lock()
            .map(|snapshot| snapshot.clone())
            .unwrap_or_else(|_| TunnelSnapshot {
                state: TunnelState::Error,
                public_url: None,
                error: Some("remote tunnel state lock poisoned".to_string()),
            })
    }

    pub fn stop(&mut self) {
        self.stop_requested.store(true, Ordering::SeqCst);
        if let Some(supervisor) = self.supervisor.take() {
            let _ = supervisor.join();
        }
        update_snapshot(&self.snapshot, TunnelState::Stopped, None, None);
    }
}

impl Drop for LocalhostRunTunnel {
    fn drop(&mut self) {
        self.stop();
    }
}

fn supervise(
    command_spec: TunnelCommand,
    stop_requested: Arc<AtomicBool>,
    snapshot: Arc<Mutex<TunnelSnapshot>>,
) {
    let mut attempt = 0_u32;
    while !stop_requested.load(Ordering::SeqCst) {
        update_snapshot(
            &snapshot,
            TunnelState::Starting,
            None,
            if attempt == 0 {
                None
            } else {
                Some("reconnecting to localhost.run".to_string())
            },
        );

        let mut command = Command::new(&command_spec.program);
        command
            .args(&command_spec.args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        crate::modules::proc::hide_console(&mut command);

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(error) => {
                let message = format!("could not start ssh tunnel: {error}");
                log::warn!("{message}");
                update_snapshot(&snapshot, TunnelState::Error, None, Some(message));
                attempt = attempt.saturating_add(1);
                wait_for_retry(&stop_requested, retry_delay(attempt));
                continue;
            }
        };

        let (output_tx, output_rx) = mpsc::channel::<String>();
        if let Some(stdout) = child.stdout.take() {
            spawn_output_reader(stdout, output_tx.clone());
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_output_reader(stderr, output_tx);
        }

        let mut public_url = None;
        let mut origin_registered = !command_spec.requires_origin_registration;
        let mut ready = false;
        let mut last_health_check = Instant::now();
        loop {
            while let Ok(line) = output_rx.try_recv() {
                if let Some(url) = extract_public_https_url(&line) {
                    public_url = Some(url);
                }
                if command_spec.requires_origin_registration && cloudflared_origin_registered(&line)
                {
                    origin_registered = true;
                }
                if command_spec.requires_origin_registration
                    && cloudflared_origin_unregistered(&line)
                {
                    origin_registered = false;
                    ready = false;
                    update_snapshot(
                        &snapshot,
                        TunnelState::Degraded,
                        None,
                        Some("cloudflare tunnel is reconnecting".to_string()),
                    );
                }
                if !ready && origin_registered {
                    if let Some(url) = public_url.clone() {
                        ready = true;
                        attempt = 0;
                        log::info!("remote tunnel ready: url={url}");
                        update_snapshot(&snapshot, TunnelState::Ready, Some(url), None);
                    }
                }
            }

            if stop_requested.load(Ordering::SeqCst) {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }

            if ready && last_health_check.elapsed() >= Duration::from_secs(30) {
                last_health_check = Instant::now();
                if !public_url
                    .as_deref()
                    .is_some_and(public_tunnel_is_resolvable)
                {
                    let message =
                        "public tunnel hostname no longer resolves; recreating it".to_string();
                    log::warn!("{message}");
                    update_snapshot(&snapshot, TunnelState::Degraded, None, Some(message));
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
            }

            match child.try_wait() {
                Ok(Some(status)) => {
                    let message = if ready {
                        format!("localhost.run tunnel disconnected ({status})")
                    } else {
                        format!("localhost.run tunnel exited before becoming ready ({status})")
                    };
                    log::warn!("{message}");
                    update_snapshot(&snapshot, TunnelState::Degraded, None, Some(message));
                    break;
                }
                Ok(None) => thread::sleep(Duration::from_millis(50)),
                Err(error) => {
                    let message = format!("could not inspect localhost.run tunnel: {error}");
                    log::warn!("{message}");
                    let _ = child.kill();
                    let _ = child.wait();
                    update_snapshot(&snapshot, TunnelState::Error, None, Some(message));
                    break;
                }
            }
        }

        if stop_requested.load(Ordering::SeqCst) {
            break;
        }
        attempt = attempt.saturating_add(1);
        wait_for_retry(&stop_requested, retry_delay(attempt));
    }

    update_snapshot(&snapshot, TunnelState::Stopped, None, None);
}

fn spawn_output_reader<R>(reader: R, sender: mpsc::Sender<String>)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });
}

fn retry_delay(attempt: u32) -> Duration {
    Duration::from_secs(1_u64 << attempt.min(4))
}

fn wait_for_retry(stop_requested: &AtomicBool, duration: Duration) {
    let steps = duration.as_millis().div_ceil(100) as u64;
    for _ in 0..steps {
        if stop_requested.load(Ordering::SeqCst) {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn update_snapshot(
    snapshot: &Mutex<TunnelSnapshot>,
    state: TunnelState,
    public_url: Option<String>,
    error: Option<String>,
) {
    if let Ok(mut snapshot) = snapshot.lock() {
        snapshot.state = state;
        snapshot.public_url = public_url;
        snapshot.error = error;
    }
}
