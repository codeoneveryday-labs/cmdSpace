#![deny(clippy::expect_used, clippy::unwrap_used)]

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ShellErrorKind {
    EmptyCommand,
    CwdRejected,
    CommandBuild,
    Spawn,
    MissingPipe,
    Wait,
    WorkerUnavailable,
}

/// Safe one-shot shell error exposed at the Tauri boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShellError {
    pub(crate) kind: ShellErrorKind,
}

impl ShellError {
    pub(crate) const fn new(kind: ShellErrorKind) -> Self {
        Self { kind }
    }

    fn code(self) -> &'static str {
        match self.kind {
            ShellErrorKind::EmptyCommand => "SHELL_EMPTY_COMMAND",
            ShellErrorKind::CwdRejected => "SHELL_CWD_REJECTED",
            ShellErrorKind::CommandBuild => "SHELL_BUILD_FAILED",
            ShellErrorKind::Spawn => "SHELL_SPAWN_FAILED",
            ShellErrorKind::MissingPipe => "SHELL_PIPE_UNAVAILABLE",
            ShellErrorKind::Wait => "SHELL_WAIT_FAILED",
            ShellErrorKind::WorkerUnavailable => "SHELL_WORKER_UNAVAILABLE",
        }
    }

    fn safe_message(self) -> &'static str {
        match self.kind {
            ShellErrorKind::EmptyCommand => "shell command is empty",
            ShellErrorKind::CwdRejected => "shell working directory is not authorized",
            ShellErrorKind::CommandBuild => "shell command could not be prepared",
            ShellErrorKind::Spawn => "shell process could not be started",
            ShellErrorKind::MissingPipe => "shell output pipe is unavailable",
            ShellErrorKind::Wait => "shell process status is unavailable",
            ShellErrorKind::WorkerUnavailable => "shell worker is unavailable",
        }
    }
}

impl Display for ShellError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.safe_message())
    }
}

impl std::error::Error for ShellError {}

impl Serialize for ShellError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IpcError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.safe_message())?;
        state.end()
    }
}

pub type ShellResult<T> = std::result::Result<T, ShellError>;

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn shell_errors_serialize_stable_codes_and_safe_messages() {
        let value = serde_json::to_value(ShellError::new(ShellErrorKind::CwdRejected))
            .expect("serialize shell error");

        assert_eq!(value["code"], "SHELL_CWD_REJECTED");
        assert_eq!(
            value["message"],
            "shell working directory is not authorized"
        );
    }
}
