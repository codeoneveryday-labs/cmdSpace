use serde_json::Value;

pub fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .get(field)?
        .as_str()
        .filter(|value| !value.trim().is_empty())
}

pub fn preview_text(value: &Value) -> Option<String> {
    let content = value.get("message")?.get("content")?;
    if let Some(text) = content.as_str() {
        return non_empty_preview(text);
    }
    content.as_array()?.iter().find_map(|part| {
        (part.get("type").and_then(Value::as_str) == Some("text"))
            .then(|| part.get("text").and_then(Value::as_str))
            .flatten()
            .and_then(non_empty_preview)
    })
}

pub fn non_empty_preview(text: &str) -> Option<String> {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        None
    } else {
        Some(collapsed.chars().take(160).collect())
    }
}

pub fn fallback_title(provider: &str, session_id: &str) -> String {
    format!(
        "{} session {}",
        provider,
        session_id.chars().take(8).collect::<String>()
    )
}

#[cfg(test)]
mod tests {
    use super::{fallback_title, non_empty_preview, preview_text, string_field};

    #[test]
    fn normalizes_whitespace_and_bounds_preview_text() {
        assert_eq!(
            non_empty_preview("  fix\n\tterminal  "),
            Some("fix terminal".into())
        );
        assert_eq!(non_empty_preview(" \n "), None);
    }

    #[test]
    fn extracts_text_from_structured_message_content() {
        let value = serde_json::json!({
            "message": {"content": [{"type": "text", "text": "Fix the shell"}]}
        });
        assert_eq!(preview_text(&value), Some("Fix the shell".into()));
    }

    #[test]
    fn ignores_empty_fields_and_builds_fallback_titles() {
        let value = serde_json::json!({"cwd": "  "});
        assert_eq!(string_field(&value, "cwd"), None);
        assert_eq!(
            fallback_title("Codex", "123456789"),
            "Codex session 12345678"
        );
    }
}
