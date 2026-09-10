use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};
use std::path::PathBuf;

#[derive(Debug)]
pub enum GitError {
    NotInstalled,
    TooOld {
        found: String,
        required: &'static str,
    },
    NotADirectory(String),
    PathOutsideWorkspace(PathBuf),
    InvalidPath(String),
    FileTooLarge {
        path: PathBuf,
        size: u64,
        max: u64,
    },
    SymlinkRejected(PathBuf),
    NoUpstream,
    AuthRequired(String),
    HostKeyUnverified,
    TimedOut(&'static str),
    EmptyCommitMessage,
    CommandFailed {
        context: &'static str,
        detail: String,
    },
    Spawn(String),
    Io(std::io::Error),
    WorkerUnavailable,
}

impl GitError {
    pub fn command(context: &'static str, detail: impl Into<String>) -> Self {
        GitError::CommandFailed {
            context,
            detail: detail.into(),
        }
    }

    fn code(&self) -> &'static str {
        match self {
            Self::NotInstalled => "GIT_NOT_INSTALLED",
            Self::TooOld { .. } => "GIT_VERSION_UNSUPPORTED",
            Self::NotADirectory(_) => "GIT_PATH_NOT_DIRECTORY",
            Self::PathOutsideWorkspace(_) => "GIT_PATH_NOT_AUTHORIZED",
            Self::InvalidPath(_) => "GIT_PATH_INVALID",
            Self::FileTooLarge { .. } => "GIT_FILE_TOO_LARGE",
            Self::SymlinkRejected(_) => "GIT_SYMLINK_REJECTED",
            Self::NoUpstream => "GIT_NO_UPSTREAM",
            Self::AuthRequired(_) => "GIT_AUTH_REQUIRED",
            Self::HostKeyUnverified => "GIT_HOST_KEY_UNVERIFIED",
            Self::TimedOut(_) => "GIT_TIMED_OUT",
            Self::EmptyCommitMessage => "GIT_EMPTY_COMMIT_MESSAGE",
            Self::CommandFailed { .. } => "GIT_COMMAND_FAILED",
            Self::Spawn(_) => "GIT_SPAWN_FAILED",
            Self::Io(_) => "GIT_IO_FAILED",
            Self::WorkerUnavailable => "GIT_WORKER_UNAVAILABLE",
        }
    }

    fn safe_message(&self) -> &'static str {
        match self {
            Self::NotInstalled => "Git is not installed",
            Self::TooOld { .. } => "Installed Git version is unsupported",
            Self::NotADirectory(_) => "Git path is not a directory",
            Self::PathOutsideWorkspace(_) => "Git path is not authorized",
            Self::InvalidPath(_) => "Git path is invalid",
            Self::FileTooLarge { .. } => "Git file is too large to process",
            Self::SymlinkRejected(_) => "Git path cannot follow a symlink",
            Self::NoUpstream => "Git branch has no upstream",
            Self::AuthRequired(_) => "Git authentication is required",
            Self::HostKeyUnverified => "Git host key is not verified",
            Self::TimedOut(_) => "Git operation timed out",
            Self::EmptyCommitMessage => "Git commit message is empty",
            Self::CommandFailed { .. } => "Git operation failed",
            Self::Spawn(_) => "Git process could not be started",
            Self::Io(_) => "Git operation could not access the filesystem",
            Self::WorkerUnavailable => "Git worker is unavailable",
        }
    }
}

impl Display for GitError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            GitError::NotInstalled => write!(
                f,
                "git is not available on PATH. Install Git and retry."
            ),
            GitError::TooOld { found, required } => write!(
                f,
                "git {found} is too old; cmdSpace needs git {required} or newer.",
            ),
            GitError::NotADirectory(p) => write!(f, "not a directory: {p}"),
            GitError::PathOutsideWorkspace(p) => write!(
                f,
                "path is outside the authorized workspace: {}",
                p.display()
            ),
            GitError::InvalidPath(p) => write!(f, "invalid path: {p}"),
            GitError::FileTooLarge { path, size, max } => write!(
                f,
                "file too large to diff ({size} bytes, max {max}): {}",
                path.display()
            ),
            GitError::SymlinkRejected(p) => {
                write!(f, "refusing to follow symlink: {}", p.display())
            }
            GitError::NoUpstream => write!(
                f,
                "no upstream configured. Run `git push -u <remote> <branch>` in the terminal first."
            ),
            GitError::AuthRequired(detail) => write!(
                f,
                "authentication required: {detail}. Configure a credential helper or SSH key."
            ),
            GitError::HostKeyUnverified => write!(
                f,
                "host key verification failed. Run the command once in the terminal to trust the host."
            ),
            GitError::TimedOut(op) => write!(f, "{op} timed out"),
            GitError::EmptyCommitMessage => write!(f, "commit message cannot be empty"),
            GitError::CommandFailed { context, detail } => {
                if detail.is_empty() {
                    write!(f, "{context}")
                } else {
                    write!(f, "{context}: {detail}")
                }
            }
            GitError::Spawn(err) => write!(f, "failed to spawn git: {err}"),
            GitError::Io(err) => write!(f, "io error: {err}"),
            GitError::WorkerUnavailable => write!(f, "git worker is unavailable"),
        }
    }
}

impl std::error::Error for GitError {}

impl Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IpcError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.safe_message())?;
        state.end()
    }
}

impl From<std::io::Error> for GitError {
    fn from(value: std::io::Error) -> Self {
        GitError::Io(value)
    }
}

pub type Result<T> = std::result::Result<T, GitError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_errors_serialize_stable_codes_without_native_details() {
        let error = GitError::AuthRequired(
            "https://user:super-secret@example.test/private-repo".to_string(),
        );
        let value = serde_json::to_value(error).expect("serialize Git error");

        assert_eq!(value["code"], "GIT_AUTH_REQUIRED");
        assert_eq!(value["message"], "Git authentication is required");
        let serialized = value.to_string();
        assert!(!serialized.contains("super-secret"));
        assert!(!serialized.contains("private-repo"));
    }

    #[test]
    fn git_errors_classify_authorization_and_timeout_without_paths() {
        let unauthorized = GitError::PathOutsideWorkspace(PathBuf::from("/private/repo"));
        let timeout = GitError::TimedOut("git status");

        assert_eq!(unauthorized.code(), "GIT_PATH_NOT_AUTHORIZED");
        assert_eq!(timeout.code(), "GIT_TIMED_OUT");
        assert_eq!(
            serde_json::to_value(unauthorized).expect("serialize authorization error")["message"],
            "Git path is not authorized"
        );
        assert_eq!(
            serde_json::to_value(timeout).expect("serialize timeout error")["message"],
            "Git operation timed out"
        );
    }

    #[test]
    fn git_errors_serialize_every_boundary_classification() {
        let cases = vec![
            (
                GitError::NotInstalled,
                "GIT_NOT_INSTALLED",
                "Git is not installed",
            ),
            (
                GitError::TooOld {
                    found: "1.0".to_string(),
                    required: "2.0",
                },
                "GIT_VERSION_UNSUPPORTED",
                "Installed Git version is unsupported",
            ),
            (
                GitError::NotADirectory("/private/repo".to_string()),
                "GIT_PATH_NOT_DIRECTORY",
                "Git path is not a directory",
            ),
            (
                GitError::InvalidPath("unsafe:path".to_string()),
                "GIT_PATH_INVALID",
                "Git path is invalid",
            ),
            (
                GitError::FileTooLarge {
                    path: PathBuf::from("/private/repo/large.patch"),
                    size: 1,
                    max: 0,
                },
                "GIT_FILE_TOO_LARGE",
                "Git file is too large to process",
            ),
            (
                GitError::SymlinkRejected(PathBuf::from("/private/repo/link")),
                "GIT_SYMLINK_REJECTED",
                "Git path cannot follow a symlink",
            ),
            (
                GitError::NoUpstream,
                "GIT_NO_UPSTREAM",
                "Git branch has no upstream",
            ),
            (
                GitError::HostKeyUnverified,
                "GIT_HOST_KEY_UNVERIFIED",
                "Git host key is not verified",
            ),
            (
                GitError::EmptyCommitMessage,
                "GIT_EMPTY_COMMIT_MESSAGE",
                "Git commit message is empty",
            ),
            (
                GitError::CommandFailed {
                    context: "git status",
                    detail: "private detail".to_string(),
                },
                "GIT_COMMAND_FAILED",
                "Git operation failed",
            ),
            (
                GitError::Spawn("private process error".to_string()),
                "GIT_SPAWN_FAILED",
                "Git process could not be started",
            ),
            (
                GitError::Io(std::io::Error::other("private filesystem error")),
                "GIT_IO_FAILED",
                "Git operation could not access the filesystem",
            ),
            (
                GitError::WorkerUnavailable,
                "GIT_WORKER_UNAVAILABLE",
                "Git worker is unavailable",
            ),
        ];

        for (error, code, message) in cases {
            let value = serde_json::to_value(error).expect("serialize Git error");
            assert_eq!(value["code"], code);
            assert_eq!(value["message"], message);
        }
    }
}
