use serde::Serialize;

use crate::modules::fs::{FsError, FsResult};
use crate::modules::workspace::{resolve_path, WorkspaceEnv};

const MAX_READ_BYTES: u64 = 10 * 1024 * 1024;
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ReadResult {
    Text {
        content: String,
        size: u64,
    },
    Binary {
        size: u64,
    },
    /// File exceeds MAX_READ_BYTES. UI decides whether to offer "open anyway".
    TooLarge {
        size: u64,
        limit: u64,
    },
}

#[tauri::command]
pub fn fs_read_file(path: String, workspace: Option<WorkspaceEnv>) -> FsResult<ReadResult> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let p = resolve_path(&path, &workspace);
    let meta = std::fs::metadata(&p).map_err(|e| {
        log::debug!("fs_read_file stat({}) failed: {e}", p.display());
        FsError::io("stat", &e)
    })?;

    let size = meta.len();
    if size > MAX_READ_BYTES {
        return Ok(ReadResult::TooLarge {
            size,
            limit: MAX_READ_BYTES,
        });
    }

    let bytes = std::fs::read(&p).map_err(|e| {
        log::debug!("fs_read_file read({}) failed: {e}", p.display());
        FsError::io("read", &e)
    })?;

    // Null-byte sniff on the first chunk catches common binary files cheaply.
    let sniff_len = bytes.len().min(BINARY_SNIFF_BYTES);
    if bytes[..sniff_len].contains(&0) {
        return Ok(ReadResult::Binary { size });
    }

    match String::from_utf8(bytes) {
        Ok(content) => Ok(ReadResult::Text { content, size }),
        Err(_) => Ok(ReadResult::Binary { size }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_utf8_text_without_changing_success_shape() {
        let directory = tempfile::tempdir().expect("create temp directory");
        let path = directory.path().join("note.txt");
        std::fs::write(&path, "hello").expect("write text fixture");

        let result =
            fs_read_file(path.to_string_lossy().into_owned(), None).expect("read text fixture");
        assert!(matches!(
            result,
            ReadResult::Text { content, size } if content == "hello" && size == 5
        ));
    }

    #[test]
    fn classifies_binary_and_too_large_files_before_decoding() {
        let directory = tempfile::tempdir().expect("create temp directory");
        let binary_path = directory.path().join("data.bin");
        std::fs::write(&binary_path, [0_u8, 1, 2]).expect("write binary fixture");

        let binary = fs_read_file(binary_path.to_string_lossy().into_owned(), None)
            .expect("read binary fixture");
        assert!(matches!(binary, ReadResult::Binary { size: 3 }));

        let large_path = directory.path().join("large.bin");
        std::fs::File::create(&large_path)
            .expect("create large fixture")
            .set_len(MAX_READ_BYTES + 1)
            .expect("size large fixture");
        let large = fs_read_file(large_path.to_string_lossy().into_owned(), None)
            .expect("inspect large fixture");
        assert!(matches!(
            large,
            ReadResult::TooLarge { size, limit }
                if size == MAX_READ_BYTES + 1 && limit == MAX_READ_BYTES
        ));
    }

    #[test]
    fn returns_typed_errors_for_missing_and_directory_paths() {
        let directory = tempfile::tempdir().expect("create temp directory");
        let missing = directory.path().join("missing.txt");
        let missing_error = fs_read_file(missing.to_string_lossy().into_owned(), None)
            .err()
            .expect("missing path should fail");
        let missing_json = serde_json::to_value(missing_error).expect("serialize missing error");
        assert_eq!(missing_json["code"], "FS_NOT_FOUND");

        let directory_error = fs_read_file(directory.path().to_string_lossy().into_owned(), None)
            .err()
            .expect("directory path should fail");
        let directory_json =
            serde_json::to_value(directory_error).expect("serialize directory error");
        assert_eq!(directory_json["code"], "FS_NOT_A_FILE");
    }
}
