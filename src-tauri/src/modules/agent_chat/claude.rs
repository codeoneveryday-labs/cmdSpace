pub fn build_contextual_prompt(history: &[(String, String)], prompt: &str) -> String {
    if history.is_empty() {
        return prompt.to_string();
    }
    let mut output = String::from("Continue this coding-agent conversation in the same workspace.");
    for (role, text) in history {
        let label = if role == "assistant" { "Assistant" } else { "User" };
        output.push_str("\n\n");
        output.push_str(label);
        output.push_str(": ");
        output.push_str(text);
    }
    output.push_str("\n\nUser: ");
    output.push_str(prompt);
    output
}
