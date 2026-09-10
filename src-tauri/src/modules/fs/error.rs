#![deny(clippy::expect_used, clippy::unwrap_used)]

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FsErrorKind {
    NotFound,
    PermissionDenied,
    InvalidInput,
    IsDirectory,
    Other,
}

/// Safe filesystem error returned at the Tauri boundary.
///
/// Native details remain available in logs, while the serialized response is
/// stable and never includes a user path or operating-system error string.
#[derive(Debug)]
pub struct FsError {
    operation: &'static str,
    kind: FsErrorKind,
}

impl FsError {
    pub(crate) fn io(operation: &'static str, error: &std::io::Error) -> Self {
        let kind = match error.kind() {
            std::io::ErrorKind::NotFound => FsErrorKind::NotFound,
            std::io::ErrorKind::PermissionDenied => FsErrorKind::PermissionDenied,
            std::io::ErrorKind::InvalidInput => FsErrorKind::InvalidInput,
            std::io::ErrorKind::IsADirectory => FsErrorKind::IsDirectory,
            _ => FsErrorKind::Other,
        };
        Self { operation, kind }
    }

    fn code(&self) -> &'static str {
        match self.kind {
            FsErrorKind::NotFound => "FS_NOT_FOUND",
            FsErrorKind::PermissionDenied => "FS_PERMISSION_DENIED",
            FsErrorKind::InvalidInput => "FS_INVALID_PATH",
            FsErrorKind::IsDirectory => "FS_NOT_A_FILE",
            FsErrorKind::Other => "FS_OPERATION_FAILED",
        }
    }

    fn safe_message(&self) -> String {
        let subject = match self.kind {
            FsErrorKind::NotFound => "path was not found",
            FsErrorKind::PermissionDenied => "permission was denied",
            FsErrorKind::InvalidInput => "path is invalid",
            FsErrorKind::IsDirectory => "path is not a regular file",
            FsErrorKind::Other => "operation failed",
        };
        format!("filesystem {}: {subject}", self.operation)
    }
}

impl Display for FsError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.safe_message())
    }
}

impl std::error::Error for FsError {}

impl Serialize for FsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IpcError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.safe_message())?;
        state.end()
    }
}

pub type FsResult<T> = std::result::Result<T, FsError>;

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn filesystem_errors_serialize_stable_codes_without_native_details() {
        let error = FsError::io(
            "read",
            &std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "/Users/private/.ssh/id_rsa",
            ),
        );
        let value = serde_json::to_value(error).expect("serialize filesystem error");

        assert_eq!(value["code"], "FS_PERMISSION_DENIED");
        assert_eq!(value["message"], "filesystem read: permission was denied");
        assert!(!value["message"]
            .as_str()
            .expect("serialized message")
            .contains(".ssh"));
    }

    #[test]
    fn filesystem_errors_classify_missing_and_directory_paths() {
        let missing = FsError::io("stat", &std::io::Error::from(std::io::ErrorKind::NotFound));
        let directory = FsError::io(
            "read",
            &std::io::Error::from(std::io::ErrorKind::IsADirectory),
        );

        assert_eq!(missing.code(), "FS_NOT_FOUND");
        assert_eq!(directory.code(), "FS_NOT_A_FILE");
    }
}
