use super::super::db;
use super::super::{RemoteResponse, RemoteUiState};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub fn remote_ui_dir(app: &tauri::AppHandle) -> PathBuf {
    let resource_dir = app.path().resource_dir().ok();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    #[cfg(debug_assertions)]
    {
        development_remote_ui_dir(resource_dir.as_deref(), &cwd)
    }
    #[cfg(not(debug_assertions))]
    {
        remote_ui_dir_from(resource_dir.as_deref(), &cwd)
    }
}

pub fn development_remote_ui_dir(_resource_dir: Option<&Path>, cwd: &Path) -> PathBuf {
    workspace_remote_ui_dir(cwd)
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn remote_ui_dir_from(resource_dir: Option<&Path>, cwd: &Path) -> PathBuf {
    if let Some(packaged) = resource_dir.map(|dir| dir.join("remote-ui")) {
        if packaged.join("remote.html").is_file() {
            return packaged;
        }
    }

    workspace_remote_ui_dir(cwd)
}

pub fn workspace_remote_ui_dir(cwd: &Path) -> PathBuf {
    let direct = cwd.join("dist");
    if direct.exists() {
        return direct;
    }

    if let Some(parent) = cwd.parent() {
        let sibling = parent.join("dist");
        if sibling.exists() {
            return sibling;
        }
    }

    direct
}

pub fn remote_asset_response(path: &str, dist_dir: &Path) -> Result<RemoteResponse, String> {
    let asset_path = remote_asset_path(path, dist_dir)?;
    let body = fs::read(&asset_path)
        .map_err(|e| format!("remote UI asset missing: {} ({e})", asset_path.display()))?;
    Ok(RemoteResponse {
        status: "200 OK",
        content_type: content_type_for_path(&asset_path),
        body,
    })
}

pub fn remote_asset_path(path: &str, dist_dir: &Path) -> Result<PathBuf, String> {
    let clean_path = path.split('?').next().unwrap_or("/");
    let clean_path = clean_path.split('#').next().unwrap_or(clean_path);

    if clean_path
        .split('/')
        .any(|segment| segment == ".." || segment.contains('\\'))
    {
        return Err("remote UI asset path is invalid".to_string());
    }

    let relative = clean_path.trim_start_matches('/');
    let candidate = if relative.is_empty() || relative == "index.html" {
        dist_dir.join("remote.html")
    } else {
        dist_dir.join(relative)
    };

    if candidate.is_file() {
        return Ok(candidate);
    }

    let remote_html = dist_dir.join("remote.html");
    let can_spa_fallback = Path::new(relative)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_none();
    if can_spa_fallback && remote_html.is_file() {
        return Ok(remote_html);
    }

    Ok(candidate)
}

pub fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

pub fn remote_state_response() -> Result<RemoteResponse, String> {
    let conn = db::init_db()?;
    let workspaces = db::list_workspaces_inner(&conn)?;
    let recent_workspaces = db::list_recent_workspaces_inner(&conn)?;
    let hostname = machine_hostname();
    let body = serde_json::to_vec(&RemoteUiState {
        workspaces,
        recent_workspaces,
        hostname,
    })
    .map_err(|e| format!("remote UI state serialization failed: {e}"))?;

    Ok(RemoteResponse {
        status: "200 OK",
        content_type: "application/json; charset=utf-8",
        body,
    })
}

pub fn machine_hostname() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMPUTERNAME").unwrap_or_default()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut buf = [0u8; 256];
        // SAFETY: buf is a valid writable buffer of 256 bytes; gethostname never
        // writes past it and returns a NUL-terminated name on success.
        let result = unsafe { libc::gethostname(buf.as_mut_ptr() as *mut libc::c_char, buf.len()) };
        if result != 0 {
            return String::new();
        }
        let end = buf.iter().position(|&byte| byte == 0).unwrap_or(buf.len());
        String::from_utf8_lossy(&buf[..end])
            .trim_end_matches('.')
            .to_string()
    }
}

pub fn remote_json_error_response(error: &str) -> RemoteResponse {
    let body = serde_json::json!({ "error": error }).to_string();
    RemoteResponse {
        status: "500 Internal Server Error",
        content_type: "application/json; charset=utf-8",
        body: body.into_bytes(),
    }
}

pub fn remote_fallback_response(reason: &str) -> RemoteResponse {
    let escaped_reason = html_escape(reason);
    let body = format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>cmdSpace Remote</title>
  <style>
    :root {{ color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    body {{ margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #0a0b0d; color: #f8fafc; }}
    main {{ width: min(92vw, 720px); border: 1px solid rgba(148,163,184,.22); border-radius: 18px; background: #17181c; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.45); }}
    h1 {{ margin: 0 0 12px; font-size: clamp(28px, 8vw, 64px); line-height: .95; letter-spacing: 0; }}
    p {{ margin: 0; color: #a8b1bd; font-size: 16px; line-height: 1.65; }}
    code {{ color: #e5e7eb; background: #272a31; border-radius: 6px; padding: 2px 6px; }}
  </style>
</head>
<body>
  <main>
    <p>REMOTE ACCESS IS ON</p>
    <h1>Remote UI bundle is not built</h1>
    <p>cmdSpace is reachable on this network, but <code>dist/remote.html</code> is missing. Run <code>pnpm build</code> once, then restart cmdSpace remote access.</p>
    <p><code>{escaped_reason}</code></p>
  </main>
</body>
</html>"#
    );
    RemoteResponse {
        status: "200 OK",
        content_type: "text/html; charset=utf-8",
        body: body.into_bytes(),
    }
}

pub fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
