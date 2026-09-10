use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WorkspaceErrorKind {
    CwdNotAccessible,
    CwdNotDirectory,
    OutsideAuthorizedWorkspace,
    #[cfg_attr(not(windows), allow(dead_code))]
    InvalidWslDistro,
    AuthorizationFailed,
}

/// Safe workspace/authorization error exposed at the Tauri boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorkspaceError {
    pub(crate) kind: WorkspaceErrorKind,
}

impl WorkspaceError {
    pub(crate) const fn new(kind: WorkspaceErrorKind) -> Self {
        Self { kind }
    }

    fn code(self) -> &'static str {
        match self.kind {
            WorkspaceErrorKind::CwdNotAccessible => "WORKSPACE_CWD_NOT_ACCESSIBLE",
            WorkspaceErrorKind::CwdNotDirectory => "WORKSPACE_CWD_NOT_DIRECTORY",
            WorkspaceErrorKind::OutsideAuthorizedWorkspace => "WORKSPACE_CWD_NOT_AUTHORIZED",
            WorkspaceErrorKind::InvalidWslDistro => "WORKSPACE_WSL_DISTRO_INVALID",
            WorkspaceErrorKind::AuthorizationFailed => "WORKSPACE_AUTHORIZATION_FAILED",
        }
    }

    fn safe_message(self) -> &'static str {
        match self.kind {
            WorkspaceErrorKind::CwdNotAccessible => "workspace cwd is not accessible",
            WorkspaceErrorKind::CwdNotDirectory => "workspace cwd is not a directory",
            WorkspaceErrorKind::OutsideAuthorizedWorkspace => {
                "workspace cwd is outside the authorized workspace"
            }
            WorkspaceErrorKind::InvalidWslDistro => "WSL distro name is invalid",
            WorkspaceErrorKind::AuthorizationFailed => "workspace authorization failed",
        }
    }
}

impl Display for WorkspaceError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.safe_message())
    }
}

impl std::error::Error for WorkspaceError {}

impl Serialize for WorkspaceError {
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

/// Compatibility conversion for native callers that have not migrated their
/// command return type yet. New Tauri boundaries should return WorkspaceError.
impl From<WorkspaceError> for String {
    fn from(value: WorkspaceError) -> Self {
        value.to_string()
    }
}

pub type WorkspaceResult<T> = std::result::Result<T, WorkspaceError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_errors_serialize_stable_codes_without_paths() {
        let value = serde_json::to_value(WorkspaceError::new(
            WorkspaceErrorKind::OutsideAuthorizedWorkspace,
        ))
        .expect("serialize workspace error");

        assert_eq!(value["code"], "WORKSPACE_CWD_NOT_AUTHORIZED");
        assert_eq!(
            value["message"],
            "workspace cwd is outside the authorized workspace"
        );
    }

    #[test]
    fn workspace_error_legacy_conversion_keeps_safe_summary() {
        let error = WorkspaceError::new(WorkspaceErrorKind::InvalidWslDistro);
        assert_eq!(String::from(error), "WSL distro name is invalid");
    }
}
