#[path = "http_assets.rs"]
mod assets;
#[allow(unused_imports)]
pub(super) use assets::{
    content_type_for_path, development_remote_ui_dir, html_escape, machine_hostname,
    remote_asset_path, remote_asset_response, remote_fallback_response, remote_json_error_response,
    remote_state_response, remote_ui_dir, remote_ui_dir_from, workspace_remote_ui_dir,
};
#[path = "http_protocol.rs"]
mod protocol;
pub(super) use protocol::{
    desktop_session_id, is_idle_client_read_error, json_error, percent_decode,
    prepare_client_stream, query_number, query_value, read_http_request, remote_session_id,
    request_body, request_method, request_path, write_binary_response, write_text_response,
};
#[path = "http_security.rs"]
mod security;
#[allow(unused_imports)]
pub(super) use security::remote_bearer_token;
pub(super) use security::{
    authorize_remote_http_request, is_legacy_remote_terminal_path,
    is_remote_websocket_origin_allowed, is_remote_websocket_upgrade, request_header,
};
