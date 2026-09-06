use super::mailbox;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Shared recall over agent memories. Each agent appends durable lessons to
/// its own `memory.md` (created by the hive bundle); this module mines those
/// files plus the shared `board.md` into an SQLite FTS5 index so any agent —
/// via the search command — recalls past knowledge in milliseconds. No
/// vector layer: at orchestration scale, keyword recall over small markdown
/// files is enough, and it keeps the whole loop inside the existing SQLite.
pub const MEMORY_SOURCE_MEMORY: &str = "memory.md";
pub const MEMORY_SOURCE_BOARD: &str = "board.md";
const MAX_SEARCH_LIMIT: u32 = 20;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHit {
    pub agent_id: String,
    pub source: String,
    pub snippet: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryIndexReport {
    pub indexed: u32,
    pub skipped_unchanged: u32,
}

pub fn ensure_memory_schema(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS orchestration_memory_fts USING fts5(
            run_id UNINDEXED,
            agent_id UNINDEXED,
            source UNINDEXED,
            content,
            content_hash UNINDEXED,
            tokenize = 'porter'
        );",
    )
    .map_err(|error| format!("Failed to create memory index: {error}"))?;
    Ok(())
}

fn content_hash(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn read_if_present(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

/// Mine one run's memories into the index. Skips files whose content hash
/// matches the indexed row (mtime-gating without stat races). Best-effort
/// per file: one unreadable memory never fails the whole reindex.
pub fn index_run_memories(
    conn: &rusqlite::Connection,
    run_id: &str,
) -> Result<MemoryIndexReport, String> {
    ensure_memory_schema(conn)?;
    let hive_root = mailbox::run_mail_dir(run_id)?;
    index_memories_at(conn, run_id, &hive_root)
}

fn index_memories_at(
    conn: &rusqlite::Connection,
    run_id: &str,
    hive_root: &Path,
) -> Result<MemoryIndexReport, String> {
    let mut documents = Vec::new();
    let board = hive_root.join(MEMORY_SOURCE_BOARD);
    if let Some(content) = read_if_present(&board) {
        documents.push((
            mailbox::ORCHESTRATOR_ID.to_string(),
            MEMORY_SOURCE_BOARD.to_string(),
            content,
        ));
    }
    let agents_dir = hive_root.join("agents");
    if let Ok(entries) = fs::read_dir(&agents_dir) {
        let mut agent_ids = entries
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        agent_ids.sort();
        for agent_id in agent_ids {
            let memory = agents_dir.join(&agent_id).join(MEMORY_SOURCE_MEMORY);
            if let Some(content) = read_if_present(&memory) {
                documents.push((agent_id, MEMORY_SOURCE_MEMORY.to_string(), content));
            }
        }
    }
    let mut report = MemoryIndexReport {
        indexed: 0,
        skipped_unchanged: 0,
    };
    for (agent_id, source, content) in documents {
        let hash = content_hash(&content);
        let unchanged: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM orchestration_memory_fts
                 WHERE run_id = ?1 AND agent_id = ?2 AND source = ?3 AND content_hash = ?4",
                rusqlite::params![run_id, agent_id, source, hash],
                |row| row.get(0),
            )
            .map(|count: i64| count > 0)
            .unwrap_or(false);
        if unchanged {
            report.skipped_unchanged += 1;
            continue;
        }
        conn.execute(
            "DELETE FROM orchestration_memory_fts
             WHERE run_id = ?1 AND agent_id = ?2 AND source = ?3",
            rusqlite::params![run_id, agent_id, source],
        )
        .map_err(|error| format!("Failed to refresh memory index: {error}"))?;
        conn.execute(
            "INSERT INTO orchestration_memory_fts
             (run_id, agent_id, source, content, content_hash)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![run_id, agent_id, source, content, hash],
        )
        .map_err(|error| format!("Failed to index memory: {error}"))?;
        report.indexed += 1;
    }
    Ok(report)
}

/// Full-text recall over one run's indexed memories. Query uses FTS5 MATCH
/// syntax (e.g. `deploy NEAR nginx`, `"exact phrase"`, `postgres OR redis`);
/// a malformed query returns an error naming the problem, never silently
/// empty results.
pub fn search_memories(
    conn: &rusqlite::Connection,
    run_id: &str,
    query: &str,
    limit: Option<u32>,
) -> Result<Vec<MemoryHit>, String> {
    ensure_memory_schema(conn)?;
    let query = query.trim();
    if query.is_empty() {
        return Err("Memory search query is required".to_string());
    }
    let limit = limit.unwrap_or(10).clamp(1, MAX_SEARCH_LIMIT);
    let mut statement = conn
        .prepare(
            "SELECT agent_id, source,
                    snippet(orchestration_memory_fts, 3, '…', '…', ' … ', 24)
             FROM orchestration_memory_fts
             WHERE run_id = ?1 AND orchestration_memory_fts MATCH ?2
             ORDER BY rank
             LIMIT ?3",
        )
        .map_err(|error| format!("Failed to prepare memory search: {error}"))?;
    let hits = statement
        .query_map(rusqlite::params![run_id, query, limit], |row| {
            Ok(MemoryHit {
                agent_id: row.get(0)?,
                source: row.get(1)?,
                snippet: row.get(2)?,
            })
        })
        .map_err(|error| format!("Invalid memory search query: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Memory search failed: {error}"))?;
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::{index_memories_at, search_memories, MemoryIndexReport};
    use std::fs;

    fn temp_hive() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "cmdspace-memory-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("agents").join("builder")).expect("dirs");
        fs::write(
            root.join("agents").join("builder").join("memory.md"),
            "# Memory\n\nDeploy with nginx reverse proxy.\n",
        )
        .expect("memory");
        fs::write(
            root.join("board.md"),
            "# Plan\n\nShip the postgres migration.\n",
        )
        .expect("board");
        root
    }

    fn memory_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().expect("memory db");
        super::ensure_memory_schema(&conn).expect("schema");
        conn
    }

    #[test]
    fn reindex_is_idempotent_and_search_recalls_both_sources() {
        let root = temp_hive();
        let conn = memory_conn();
        let first = index_memories_at(&conn, "run-1", &root).expect("index");
        assert_eq!(
            first,
            MemoryIndexReport {
                indexed: 2,
                skipped_unchanged: 0
            }
        );
        let second = index_memories_at(&conn, "run-1", &root).expect("reindex");
        assert_eq!(
            second,
            MemoryIndexReport {
                indexed: 0,
                skipped_unchanged: 2
            }
        );

        let hits = search_memories(&conn, "run-1", "nginx", None).expect("search");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].agent_id, "builder");
        assert_eq!(hits[0].source, "memory.md");
        assert!(hits[0].snippet.contains("nginx"));

        let hits = search_memories(&conn, "run-1", "postgres", None).expect("search");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].agent_id, "orchestrator");

        assert!(search_memories(&conn, "run-1", "nothingherexyz", None)
            .expect("empty")
            .is_empty());
        assert!(search_memories(&conn, "run-1", "   ", None).is_err());
        assert!(search_memories(&conn, "other-run", "nginx", None)
            .expect("scoped")
            .is_empty());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn changed_memory_reindexes_and_phrase_queries_work() {
        let root = temp_hive();
        let conn = memory_conn();
        index_memories_at(&conn, "run-1", &root).expect("index");
        fs::write(
            root.join("agents").join("builder").join("memory.md"),
            "# Memory\n\nDeploy with nginx reverse proxy and redis cache.\n",
        )
        .expect("rewrite");
        let report = index_memories_at(&conn, "run-1", &root).expect("reindex");
        assert_eq!(report.indexed, 1);
        assert_eq!(report.skipped_unchanged, 1);

        let hits = search_memories(&conn, "run-1", "\"reverse proxy\"", None).expect("phrase");
        assert_eq!(hits.len(), 1);
        let hits = search_memories(&conn, "run-1", "redis OR postgres", Some(1)).expect("or");
        assert_eq!(hits.len(), 1);
        let _ = fs::remove_dir_all(&root);
    }
}
