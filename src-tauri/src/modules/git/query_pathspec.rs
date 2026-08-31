use std::path::Path;

use crate::modules::git::errors::Result;
use crate::modules::git::utils::resolve_within_repo;

pub(crate) fn resolve_pathspecs(repo_root: &Path, paths: &[String]) -> Result<Vec<String>> {
    let mut out = Vec::with_capacity(paths.len());
    for path in paths {
        out.push(pathspec_from_input(repo_root, path)?);
    }
    Ok(out)
}

pub(crate) fn pathspec_from_input(repo_root: &Path, rel: &str) -> Result<String> {
    let resolved = resolve_within_repo(repo_root, rel)?;
    Ok(pathspec(repo_root, &resolved))
}

pub(crate) fn pathspec(repo_root: &Path, absolute: &Path) -> String {
    absolute
        .strip_prefix(repo_root)
        .map(|rel| rel.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| absolute.to_string_lossy().replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::pathspec;
    use std::path::Path;

    #[test]
    fn projects_absolute_repository_paths_to_forward_slash_pathspecs() {
        assert_eq!(
            pathspec(Path::new("/repo"), Path::new("/repo/src/main.rs")),
            "src/main.rs"
        );
    }
}
