#[path = "clipboard_paths.rs"]
mod clipboard_paths;
#[path = "import.rs"]
mod import;
#[path = "mutate_paths.rs"]
mod paths;
#[path = "trash.rs"]
mod trash;
pub use clipboard_paths::{__cmd__fs_clipboard_paths, fs_clipboard_paths};
pub use import::{
    __cmd__fs_import_clipboard_file, __cmd__fs_import_paths, fs_import_clipboard_file,
    fs_import_paths,
};
pub(super) use paths::is_same_or_descendant;
pub use paths::{
    __cmd__fs_create_dir, __cmd__fs_create_file, __cmd__fs_rename, fs_create_dir, fs_create_file,
    fs_rename,
};
pub use trash::{__cmd__fs_delete, __cmd__fs_restore, fs_delete, fs_restore};
// Keep the response DTO available at its historical mutate facade path.
#[allow(unused_imports)]
pub use trash::DeletedPath;

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};

    #[test]
    fn clipboard_import_requires_an_existing_directory() {
        let temp = tempfile::tempdir().unwrap();
        let missing_destination = temp.path().join("missing").to_string_lossy().into_owned();

        let error = fs_import_clipboard_file(
            "note.txt".to_string(),
            STANDARD.encode("note"),
            missing_destination,
            None,
        )
        .unwrap_err();

        assert!(error.contains("import destination is not a directory"));
    }
}
