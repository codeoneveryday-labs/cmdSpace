#![deny(clippy::expect_used, clippy::unwrap_used)]

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PtyErrorKind {
    SessionNotFound,
    WriteFailed,
    ResizeFailed,
    MetadataNotFound,
    CloseFailed,
}

/// Safe PTY command error exposed at the Tauri and remote boundaries.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PtyError {
    pub(crate) kind: PtyErrorKind,
}

impl PtyError {
    pub(crate) const fn new(kind: PtyErrorKind) -> Self {
        Self { kind }
    }

    fn code(self) -> &'static str {
        match self.kind {
            PtyErrorKind::SessionNotFound => "PTY_SESSION_NOT_FOUND",
            PtyErrorKind::WriteFailed => "PTY_WRITE_FAILED",
            PtyErrorKind::ResizeFailed => "PTY_RESIZE_FAILED",
            PtyErrorKind::MetadataNotFound => "PTY_METADATA_NOT_FOUND",
            PtyErrorKind::CloseFailed => "PTY_CLOSE_FAILED",
        }
    }

    fn safe_message(self) -> &'static str {
        match self.kind {
            PtyErrorKind::SessionNotFound => "PTY session is not available",
            PtyErrorKind::WriteFailed => "PTY input could not be written",
            PtyErrorKind::ResizeFailed => "PTY could not be resized",
            PtyErrorKind::MetadataNotFound => "PTY session metadata is not available",
            PtyErrorKind::CloseFailed => "PTY session could not be closed",
        }
    }
}

impl Display for PtyError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.safe_message())
    }
}

impl std::error::Error for PtyError {}

impl Serialize for PtyError {
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

impl From<PtyError> for String {
    fn from(value: PtyError) -> Self {
        value.to_string()
    }
}

pub type PtyResult<T> = std::result::Result<T, PtyError>;

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn pty_errors_serialize_stable_codes_without_session_details() {
        let value = serde_json::to_value(PtyError::new(PtyErrorKind::SessionNotFound))
            .expect("serialize PTY error");
        assert_eq!(value["code"], "PTY_SESSION_NOT_FOUND");
        assert_eq!(value["message"], "PTY session is not available");
    }
}
