use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

const IDLE: u8 = 0;
const FLUSHING: u8 = 1;
const ACKED: u8 = 2;
const EXITING: u8 = 3;
const FLUSH_TIMEOUT: Duration = Duration::from_millis(2_000);

pub struct ExitCoordinator {
    state: AtomicU8,
}

impl Default for ExitCoordinator {
    fn default() -> Self {
        Self {
            state: AtomicU8::new(IDLE),
        }
    }
}

impl ExitCoordinator {
    fn begin(&self) -> bool {
        self.state
            .compare_exchange(IDLE, FLUSHING, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn complete(&self) -> bool {
        self.state
            .compare_exchange(FLUSHING, ACKED, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn timeout(&self) -> bool {
        loop {
            let current = self.state.load(Ordering::Acquire);
            if !matches!(current, FLUSHING | ACKED) {
                return false;
            }
            if self
                .state
                .compare_exchange(current, EXITING, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
            {
                return true;
            }
        }
    }

    fn begin_exit(&self) -> bool {
        self.state
            .compare_exchange(ACKED, EXITING, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    pub(crate) fn is_exiting(&self) -> bool {
        self.state.load(Ordering::Acquire) == EXITING
    }
}

pub(crate) fn request<R: Runtime>(app: &AppHandle<R>) {
    let coordinator = app.state::<ExitCoordinator>();
    if !coordinator.begin() {
        return;
    }

    let _ = app.emit("cmdspace:exit-requested", ());
    let timeout_app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FLUSH_TIMEOUT).await;
        if timeout_app.state::<ExitCoordinator>().timeout() {
            timeout_app.exit(0);
        }
    });
}

#[tauri::command]
pub(crate) fn app_exit_flush_complete<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ExitCoordinator>,
) -> Result<(), String> {
    if state.complete() && state.begin_exit() {
        app.exit(0);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ExitCoordinator;

    #[test]
    fn coordinator_allows_one_flush_and_one_completion() {
        let coordinator = ExitCoordinator::default();
        assert!(coordinator.begin());
        assert!(!coordinator.begin());
        assert!(coordinator.complete());
        assert!(!coordinator.is_exiting());
        assert!(coordinator.begin_exit());
        assert!(coordinator.is_exiting());
        assert!(!coordinator.complete());
    }
}
