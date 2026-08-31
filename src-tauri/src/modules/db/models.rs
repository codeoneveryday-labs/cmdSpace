use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]

pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub count: i32,
    #[serde(rename = "accentColor")]
    pub accent_color: Option<String>,
    #[serde(rename = "workingFolder")]
    pub working_folder: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "displayOrder")]
    pub display_order: i32,
    #[serde(rename = "paneLayout")]
    pub pane_layout: Option<String>,
    #[serde(rename = "workspaceMode")]
    pub workspace_mode: Option<String>,
    #[serde(rename = "agentProvider")]
    pub agent_provider: Option<String>,
    #[serde(rename = "agentSessionId")]
    pub agent_session_id: Option<String>,
    #[serde(rename = "agentProviders", default)]
    pub agent_providers: Option<Vec<String>>,
    #[serde(rename = "agentSessionIds", default)]
    pub agent_session_ids: Option<Vec<Option<String>>>,
    #[serde(rename = "agentChatIds", default)]
    pub agent_chat_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct WorkspacePaneRow {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "paneIndex")]
    pub pane_index: i32,
    #[serde(rename = "workingFolder")]
    pub working_folder: Option<String>,
    #[serde(rename = "lastCommand")]
    pub last_command: Option<String>,
    #[serde(rename = "autoLaunch", default)]
    pub auto_launch: bool,
    #[serde(rename = "agentProvider", default)]
    pub agent_provider: Option<String>,
    #[serde(rename = "nativeSessionId", default)]
    pub native_session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RecentWorkspaceRow {
    pub id: String,
    pub name: String,
    pub count: i32,
    #[serde(rename = "workingFolder")]
    pub working_folder: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct AgentChatConfigRow {
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub provider: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    #[serde(rename = "permissionMode")]
    pub permission_mode: Option<String>,
    #[serde(rename = "fastMode")]
    pub fast_mode: bool,
    #[serde(rename = "planMode")]
    pub plan_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct AgentModelCacheRow {
    pub provider: String,
    pub models: Vec<AgentModelCacheEntry>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct AgentModelCacheEntry {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
}

/// A workspace created from a paired native device. It deliberately has no
/// relation to the desktop workspace/pane tables: it is a device-owned folder
/// binding, not a second view of a desktop workspace.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct MobileWorkspaceRow {
    pub id: String,
    #[serde(rename = "ownerDeviceId")]
    pub owner_device_id: String,
    pub name: String,
    #[serde(rename = "workingFolder")]
    pub working_folder: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}
