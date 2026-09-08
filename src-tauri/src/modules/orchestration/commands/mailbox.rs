use super::super::OrchestrationRuntime;
use super::core as implementation;
use crate::modules::db::DbState;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn orchestration_mail_send(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    from: String,
    to: String,
    act: super::super::mailbox::HiveAct,
    subject: String,
    body: String,
    conversation: Option<String>,
    in_reply_to: Option<String>,
) -> Result<super::super::mailbox::HiveMessage, String> {
    implementation::mail_send_impl(
        runtime,
        db,
        run_id,
        from,
        to,
        act,
        subject,
        body,
        conversation,
        in_reply_to,
    )
}
#[tauri::command]
pub fn orchestration_mail_unread(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<super::super::mailbox::MailUnread, String> {
    implementation::mail_unread_impl(runtime, run_id, agent_id)
}
#[tauri::command]
pub fn orchestration_mail_inbox(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<Vec<super::super::mailbox::HiveMessage>, String> {
    implementation::mail_inbox_impl(runtime, run_id, agent_id)
}
#[tauri::command]
pub fn orchestration_mail_ack(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    message_id: String,
) -> Result<Vec<super::super::mailbox::HiveMessage>, String> {
    implementation::mail_ack_impl(runtime, db, run_id, agent_id, message_id)
}
#[tauri::command]
pub fn orchestration_mail_route(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<super::super::router::RouteReport, String> {
    implementation::mail_route_impl(runtime, db, run_id)
}
