use super::super::{db, workspace};
use std::path::{Path, PathBuf};

/// `std::fs::canonicalize` returns Windows paths with a `\\?\` extended-length
/// prefix, while `dirs::home_dir()` and the launch-dir snapshot don't. Strip
/// the prefix so both sides compare in the same form.
pub(super) fn strip_verbatim_prefix(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    s.strip_prefix(r"\\?\")
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

pub(super) fn authorize_remote_cwd(cwd: Option<&str>) -> Result<Option<String>, String> {
    let Some(cwd) = cwd else {
        return Ok(None);
    };
    let path = strip_verbatim_prefix(
        &std::fs::canonicalize(cwd).map_err(|e| format!("cwd is not accessible: {e}"))?,
    );
    if !path.is_dir() {
        return Err("cwd is not a directory".to_string());
    }
    let home = dirs::home_dir();
    let launch = workspace::launch_cwd_snapshot();
    let allowed = home.as_deref().is_some_and(|root| path.starts_with(root))
        || launch.as_deref().is_some_and(|root| path.starts_with(root));
    if !allowed {
        return Err("remote cwd must be inside the user home or launch workspace".to_string());
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}

pub(super) fn resolve_remote_session_cwd(
    cwd: Option<&str>,
    workspace_id: Option<&str>,
) -> Result<Option<String>, String> {
    let Some(workspace_id) = workspace_id else {
        return authorize_remote_cwd(cwd);
    };
    let conn = db::init_db()?;
    let workspace = db::list_workspaces_inner(&conn)?
        .into_iter()
        .find(|workspace| workspace.id == workspace_id)
        .ok_or_else(|| "workspace does not exist".to_string())?;
    if workspace.workspace_mode.as_deref() == Some("canvas") {
        return Err("remote terminals require a standard workspace".to_string());
    }
    let working_folder = workspace
        .working_folder
        .ok_or_else(|| "workspace has no working directory".to_string())?;
    authorize_remote_cwd(Some(&working_folder))
}

pub(super) fn resolve_mobile_session_cwd(
    device_id: &str,
    cwd: Option<&str>,
    workspace_id: Option<&str>,
) -> Result<Option<String>, String> {
    match workspace_id {
        Some(workspace_id) => resolve_mobile_workspace_cwd(device_id, workspace_id).map(Some),
        None => authorize_remote_cwd(cwd),
    }
}

pub(super) fn resolve_mobile_workspace_cwd(
    device_id: &str,
    workspace_id: &str,
) -> Result<String, String> {
    let conn = db::init_db()?;
    let workspace = db::mobile_workspace_inner(&conn, device_id, workspace_id)?
        .ok_or_else(|| "mobile workspace does not exist for this device".to_string())?;
    authorize_remote_cwd(Some(&workspace.working_folder))?
        .ok_or_else(|| "mobile workspace has no working directory".to_string())
}
