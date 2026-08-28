use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum AgentChatEvent {
    Session { native_id: String },
    User { text: String },
    Assistant { text: String },
    Reasoning { text: String },
    Tool {
        id: String,
        name: String,
        status: String,
        detail: Option<String>,
    },
    Usage {
        input_tokens: u64,
        output_tokens: u64,
    },
    Error { message: String },
    Done,
}
