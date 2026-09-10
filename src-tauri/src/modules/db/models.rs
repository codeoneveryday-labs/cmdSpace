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
    #[serde(default)]
    pub pinned: bool,
}

/// Stable workspace shape exchanged over the Tauri boundary.
///
/// This intentionally mirrors the persisted fields while keeping the IPC
/// contract independent from the SQLite row type used by repositories and
/// remote projections.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct WorkspaceDto {
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
    #[serde(default)]
    pub pinned: bool,
}

impl From<WorkspaceRow> for WorkspaceDto {
    fn from(row: WorkspaceRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            count: row.count,
            accent_color: row.accent_color,
            working_folder: row.working_folder,
            created_at: row.created_at,
            updated_at: row.updated_at,
            display_order: row.display_order,
            pane_layout: row.pane_layout,
            workspace_mode: row.workspace_mode,
            pinned: row.pinned,
        }
    }
}

impl From<WorkspaceDto> for WorkspaceRow {
    fn from(dto: WorkspaceDto) -> Self {
        Self {
            id: dto.id,
            name: dto.name,
            count: dto.count,
            accent_color: dto.accent_color,
            working_folder: dto.working_folder,
            created_at: dto.created_at,
            updated_at: dto.updated_at,
            display_order: dto.display_order,
            pane_layout: dto.pane_layout,
            workspace_mode: dto.workspace_mode,
            pinned: dto.pinned,
        }
    }
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
