use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

/// Errors raised by SQLite-backed workspace persistence.
///
/// The detailed form is useful for native logs and compatibility callers. The
/// serialized form intentionally exposes only a stable code and safe summary
/// at the Tauri boundary.
#[derive(Debug)]
pub enum DbError {
    MutexPoisoned,
    Sqlite {
        context: &'static str,
        source: rusqlite::Error,
    },
    Migration {
        context: &'static str,
        source: rusqlite::Error,
    },
    UnsupportedVersion {
        found: i64,
        supported: i64,
    },
}

impl DbError {
    pub(super) fn sqlite(context: &'static str, source: rusqlite::Error) -> Self {
        Self::Sqlite { context, source }
    }

    pub(super) fn migration(context: &'static str, source: rusqlite::Error) -> Self {
        Self::Migration { context, source }
    }

    pub(crate) fn code(&self) -> &'static str {
        match self {
            Self::MutexPoisoned => "DB_MUTEX_POISONED",
            Self::Sqlite { .. } => "DB_OPERATION_FAILED",
            Self::Migration { .. } => "DB_MIGRATION_FAILED",
            Self::UnsupportedVersion { .. } => "DB_SCHEMA_UNSUPPORTED",
        }
    }

    fn safe_message(&self) -> String {
        match self {
            Self::MutexPoisoned => "database state is unavailable".to_string(),
            Self::Sqlite { context, .. } => format!("database operation failed: {context}"),
            Self::Migration { context, .. } => format!("database migration failed: {context}"),
            Self::UnsupportedVersion { supported, .. } => {
                format!("database schema is newer than supported version {supported}")
            }
        }
    }
}

impl Display for DbError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MutexPoisoned => f.write_str("database state mutex poisoned"),
            Self::Sqlite { context, source } => write!(f, "{context}: {source}"),
            Self::Migration { context, source } => write!(f, "{context}: {source}"),
            Self::UnsupportedVersion { found, supported } => write!(
                f,
                "database schema version {found} is newer than supported version {supported}"
            ),
        }
    }
}

impl std::error::Error for DbError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::MutexPoisoned | Self::UnsupportedVersion { .. } => None,
            Self::Sqlite { source, .. } | Self::Migration { source, .. } => Some(source),
        }
    }
}

impl Serialize for DbError {
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

/// Keep legacy native callers source-compatible while commands migrate to the
/// serializable typed error above.
impl From<DbError> for String {
    fn from(value: DbError) -> Self {
        value.to_string()
    }
}

pub type DbResult<T> = std::result::Result<T, DbError>;
