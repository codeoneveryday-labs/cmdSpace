use std::io::Write;
use std::sync::Arc;
use std::sync::Mutex;

use portable_pty::{ChildKiller, MasterPty};

use super::session_output::{OutputHub, OutputSubscription};

#[path = "session_bootstrap.rs"]
mod bootstrap;
#[path = "session_lifecycle.rs"]
mod lifecycle;
#[path = "session_spawn.rs"]
mod spawn_impl;
pub use spawn_impl::spawn;

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
    output: OutputHub,
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
        self.output.snapshot()
    }

    pub fn subscribe_output(&self) -> OutputSubscription {
        self.output.subscribe()
    }

    fn publish_output(&self, bytes: &[u8]) {
        self.output.publish(bytes);
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
pub(super) fn drop_session(session: Arc<Session>) {
    lifecycle::drop_session(session);
}
