use std::collections::VecDeque;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, ChildKiller, MasterPty, PtySize};
use tauri::ipc::{Channel, Response};

use super::da_filter::DaFilter;
use super::shell_init;
use crate::modules::workspace::WorkspaceEnv;

// Flusher coalesces a short window after first-byte arrival so we send chunks,
// not single bytes. MAX_IDLE is only a safety net for missed signals.
const FLUSH_COALESCE: Duration = Duration::from_millis(4);
const FLUSH_MAX_IDLE: Duration = Duration::from_millis(50);
const READ_BUF: usize = 16 * 1024;
// Cap on buffered-but-not-yet-flushed bytes. On overflow we discard the
// entire pending buffer and emit an SGR-reset + notice in its place.
// Dropping a partial prefix would slice a CSI sequence in half and corrupt
// xterm's screen state. 4 MiB is ~1000 full 80x24 screens.
const MAX_PENDING: usize = 4 * 1024 * 1024;
// Hard reset (ESC c) + dim notice. Written verbatim into the stream when
// we're forced to discard backlog.
const OVERFLOW_NOTICE: &[u8] =
    b"\x1bc\x1b[2m[cmdspace: dropped output due to backpressure]\x1b[0m\r\n";
const PROMPT_READY_MARKER: &[u8] = b"\x1b]133;A\x1b\\";

pub(super) type OutputChunk = (u64, Vec<u8>);
pub(super) type OutputSubscription = (mpsc::Receiver<OutputChunk>, Vec<OutputChunk>);

struct InitialCommandBootstrap {
    command: Option<String>,
    marker_tail: Vec<u8>,
}

impl InitialCommandBootstrap {
    fn new(command: Option<String>) -> Self {
        Self {
            command: command.filter(|command| !command.trim().is_empty()),
            marker_tail: Vec::with_capacity(PROMPT_READY_MARKER.len() - 1),
        }
    }

    fn take_when_prompt_ready(&mut self, bytes: &[u8]) -> Option<String> {
        self.command.as_ref()?;
        self.marker_tail.extend_from_slice(bytes);
        if self
            .marker_tail
            .windows(PROMPT_READY_MARKER.len())
            .any(|window| window == PROMPT_READY_MARKER)
        {
            self.marker_tail.clear();
            return self.command.take();
        }
        let tail_length = PROMPT_READY_MARKER.len() - 1;
        if self.marker_tail.len() > tail_length {
            let start = self.marker_tail.len() - tail_length;
            self.marker_tail.drain(..start);
        }
        None
    }
}

pub struct Session {
    // Field drop order is intentional. Rust drops fields top-to-bottom:
    //   1. `_job` — on Windows, closing the Job HANDLE fires
    //      KILL_ON_JOB_CLOSE, terminating the pwsh tree before the master
    //      pipe drops. Without this, ClosePseudoConsole in `master`'s Drop
    //      can block waiting for conhost to drain pending output, freezing
    //      the Tauri worker thread that triggered the close.
    //   2. `killer` — best-effort kill (redundant on Windows once Job
    //      closed, but harmless and required on Unix where there is no Job).
    //   3. `writer` — closes the input side of the master pipe.
    //   4. `master` — last; ClosePseudoConsole on Windows. By now the child
    //      is dead and conhost has nothing left to drain.
    #[cfg(windows)]
    _job: Option<super::job::PtyJob>,
    #[cfg(unix)]
    process_group: Option<i32>,
    pub killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Mutex<Box<dyn MasterPty + Send>>,
    output_subscribers: Mutex<Vec<mpsc::Sender<OutputChunk>>>,
    output_replay: Mutex<VecDeque<OutputChunk>>,
    output_sequence: AtomicU64,
}

impl Session {
    #[cfg(unix)]
    pub(crate) fn terminate_process_group(&self) {
        let Some(process_group) = self.process_group else {
            return;
        };
        // The PTY shell is the process-group leader, so this also stops any
        // foreground pipeline processes it spawned (for example Music CLI).
        unsafe {
            libc::kill(-process_group, libc::SIGTERM);
        }
    }

    pub fn output_snapshot(&self) -> Vec<u8> {
        self.output_replay
            .lock()
            .unwrap()
            .iter()
            .flat_map(|(_, chunk)| chunk.iter().copied())
            .collect()
    }

    pub fn subscribe_output(&self) -> OutputSubscription {
        let (sender, receiver) = mpsc::channel();
        self.output_subscribers.lock().unwrap().push(sender);
        let replay = self.output_replay.lock().unwrap().iter().cloned().collect();
        (receiver, replay)
    }

    fn publish_output(&self, bytes: &[u8]) {
        let sequence = self.output_sequence.fetch_add(1, Ordering::Relaxed);
        let chunk = (sequence, bytes.to_vec());
        let mut subscribers = self.output_subscribers.lock().unwrap();
        let mut replay = self.output_replay.lock().unwrap();
        replay.push_back(chunk.clone());
        while replay.len() > 128 {
            replay.pop_front();
        }
        subscribers.retain(|sender| sender.send(chunk.clone()).is_ok());
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        // If the session Arc is dropped without an explicit pty_close (e.g.
        // frontend disconnected, window crashed, dev HMR), the reader/flusher
        // threads would otherwise stay alive forever holding the child. Kill
        // the child here so the reader hits EOF and the threads unwind.
        #[cfg(unix)]
        self.terminate_process_group();
        if let Ok(mut k) = self.killer.lock() {
            let _ = k.kill();
        }
    }
}
// Serializes ConPTY create and close: overlapping pseudoconsole lifecycle
// calls corrupt the new console so its shell never pumps output (issue #356).
#[cfg(windows)]
static CONPTY_LIFECYCLE_LOCK: Mutex<()> = Mutex::new(());

pub(super) fn drop_session(session: Arc<Session>) {
    #[cfg(windows)]
    let _guard = CONPTY_LIFECYCLE_LOCK.lock().unwrap();
    drop(session);
}

struct ChildKillGuard {
    killer: Option<Box<dyn ChildKiller + Send + Sync>>,
}

impl ChildKillGuard {
    fn new(killer: Box<dyn ChildKiller + Send + Sync>) -> Self {
        Self {
            killer: Some(killer),
        }
    }

    fn disarm(&mut self) {
        self.killer = None;
    }
}

impl Drop for ChildKillGuard {
    fn drop(&mut self) {
        if let Some(mut k) = self.killer.take() {
            let _ = k.kill();
        }
    }
}

pub fn spawn(
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    initial_command: Option<String>,
    workspace: WorkspaceEnv,
    on_data: Channel<Response>,
    on_exit: Channel<i32>,
) -> Result<(Arc<Session>, PtySize), String> {
    #[cfg(windows)]
    let _spawn_guard = CONPTY_LIFECYCLE_LOCK.lock().unwrap();

    let pty_system = native_pty_system();
    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system.openpty(size).map_err(|e| e.to_string())?;

    let cmd = shell_init::build_command(cwd, workspace)?;
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    #[cfg(unix)]
    let process_group = child.process_id().and_then(|pid| i32::try_from(pid).ok());

    // Kill the child if any of the pipe setup below fails so the spawned shell
    // can't outlive an aborted pty_open.
    let mut guard = ChildKillGuard::new(child.clone_killer());
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(
        pair.master.take_writer().map_err(|e| e.to_string())?,
    ));
    guard.disarm();

    #[cfg(windows)]
    let job = match child.process_id() {
        Some(pid) => match super::job::PtyJob::create_for(pid) {
            Ok(j) => Some(j),
            Err(e) => {
                log::warn!("pty job-object setup failed for pid={pid}: {e}");
                None
            }
        },
        None => None,
    };

    let session = Arc::new(Session {
        #[cfg(windows)]
        _job: job,
        #[cfg(unix)]
        process_group,
        killer: Mutex::new(killer),
        writer: writer.clone(),
        master: Mutex::new(pair.master),
        output_subscribers: Mutex::new(Vec::new()),
        output_replay: Mutex::new(VecDeque::new()),
        output_sequence: AtomicU64::new(1),
    });

    let pending: Arc<(Mutex<Vec<u8>>, Condvar)> =
        Arc::new((Mutex::new(Vec::with_capacity(READ_BUF)), Condvar::new()));
    let done = Arc::new(AtomicBool::new(false));
    let spawn_at = Instant::now();

    let pending_r = pending.clone();
    let writer_for_da = writer.clone();
    let writer_for_initial_command = writer.clone();
    let output_session = session.clone();
    let reader_thread = thread::Builder::new()
        .name("cmdspace-pty-reader".into())
        .spawn(move || {
            let mut buf = [0u8; READ_BUF];
            let mut filtered: Vec<u8> = Vec::with_capacity(READ_BUF);
            let mut da_filter = DaFilter::new();
            let mut initial_command = InitialCommandBootstrap::new(initial_command);
            let mut dropped_bytes: u64 = 0;
            let mut logged_first = false;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if !logged_first {
                            logged_first = true;
                            log::debug!(
                                "pty first byte after {}ms",
                                spawn_at.elapsed().as_millis()
                            );
                        }
                        filtered.clear();
                        da_filter.process(&buf[..n], &mut filtered, |reply| {
                            if let Ok(mut w) = writer_for_da.lock() {
                                let _ = w.write_all(reply);
                            }
                        });
                        if filtered.is_empty() {
                            continue;
                        }
                        if let Some(command) = initial_command.take_when_prompt_ready(&filtered) {
                            if let Ok(mut writer) = writer_for_initial_command.lock() {
                                if let Err(error) = writer
                                    .write_all(command.as_bytes())
                                    .and_then(|_| writer.write_all(b"\r"))
                                    .and_then(|_| writer.flush())
                                {
                                    log::warn!("pty initial command write failed: {error}");
                                }
                            }
                        }
                        output_session.publish_output(&filtered);
                        let (lock, cv) = &*pending_r;
                        let mut g = lock.lock().unwrap();
                        if g.len() + filtered.len() > MAX_PENDING {
                            dropped_bytes += g.len() as u64;
                            g.clear();
                            g.extend_from_slice(OVERFLOW_NOTICE);
                        }
                        g.extend_from_slice(&filtered);
                        cv.notify_one();
                    }
                    Err(e) => {
                        log::debug!("pty reader ended: {e}");
                        break;
                    }
                }
            }
            pending_r.1.notify_one();
            if dropped_bytes > 0 {
                log::warn!("pty backpressure: dropped {dropped_bytes} bytes (cap {MAX_PENDING})");
            }
        })
        .expect("spawn pty reader thread");

    let on_data_flush = on_data.clone();
    let pending_f = pending.clone();
    let done_f = done.clone();
    thread::Builder::new()
        .name("cmdspace-pty-flusher".into())
        .spawn(move || {
            let (lock, cv) = &*pending_f;
            loop {
                {
                    let mut g = lock.lock().unwrap();
                    while g.is_empty() {
                        if done_f.load(Ordering::Acquire) {
                            return;
                        }
                        let (next, _) = cv.wait_timeout(g, FLUSH_MAX_IDLE).unwrap();
                        g = next;
                    }
                }
                // Coalesce a short window so a burst flushes as one chunk.
                thread::sleep(FLUSH_COALESCE);
                let chunk = std::mem::take(&mut *lock.lock().unwrap());
                if chunk.is_empty() {
                    continue;
                }
                if let Err(e) = on_data_flush.send(Response::new(chunk)) {
                    log::debug!("pty flusher exiting, channel closed: {e}");
                    break;
                }
            }
        })
        .expect("spawn pty flusher thread");

    let on_data_exit = on_data;
    let pending_e = pending;
    let done_e = done;
    thread::Builder::new()
        .name("cmdspace-pty-waiter".into())
        .spawn(move || {
            let code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(e) => {
                    log::warn!("pty child wait failed: {e}");
                    -1
                }
            };
            // Wait for the reader to hit EOF before taking a final snapshot of
            // `pending`, so the last line of output never races the Exit event.
            #[cfg(windows)]
            {
                let deadline = Instant::now() + Duration::from_millis(50);
                while Instant::now() < deadline && !reader_thread.is_finished() {
                    thread::sleep(Duration::from_millis(5));
                }
            }
            #[cfg(not(windows))]
            if let Err(e) = reader_thread.join() {
                log::error!("pty reader thread panicked: {e:?}");
            }
            let (lock, cv) = &*pending_e;
            let tail = std::mem::take(&mut *lock.lock().unwrap());
            if !tail.is_empty() {
                if let Err(e) = on_data_exit.send(Response::new(tail)) {
                    log::debug!("pty final-data send failed (channel closed): {e}");
                }
            }
            done_e.store(true, Ordering::Release);
            cv.notify_all();
            if let Err(e) = on_exit.send(code) {
                log::debug!("pty exit send failed (channel closed): {e}");
            }
        })
        .expect("spawn pty waiter thread");

    Ok((session, size))
}

#[cfg(test)]
mod tests {
    use super::InitialCommandBootstrap;

    #[test]
    fn initial_command_waits_for_a_prompt_marker_split_across_chunks() {
        let mut bootstrap = InitialCommandBootstrap::new(Some("codex".into()));

        assert_eq!(bootstrap.take_when_prompt_ready(b"boot\x1b]133;"), None);
        assert_eq!(
            bootstrap.take_when_prompt_ready(b"A\x1b\\prompt"),
            Some("codex".into())
        );
    }

    #[test]
    fn initial_command_runs_only_once() {
        let mut bootstrap = InitialCommandBootstrap::new(Some("codex".into()));

        assert_eq!(
            bootstrap.take_when_prompt_ready(b"\x1b]133;A\x1b\\"),
            Some("codex".into())
        );
        assert_eq!(bootstrap.take_when_prompt_ready(b"\x1b]133;A\x1b\\"), None);
    }
}
