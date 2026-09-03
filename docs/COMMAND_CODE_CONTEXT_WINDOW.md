# Command Code CLI: Context Window Monitoring, Token Extraction & Calculation Guide

> **Engineering Reference**: Technical specification and implementation guide for inspecting, extracting, and calculating real-time Context Window utilization in Command Code (`cmd` / `command-code`) sessions.

---

## 1. Context Window Architecture in Command Code

### 1.1. Core Invariants
**Command Code** (`cmd` / `cmdc` / `command-code`) supports multi-provider model switching (Claude, OpenAI GPT, DeepSeek, Kimi, Qwen):

1. **Active Context Usage**:
   - For every turn, Command Code logs detailed token metrics in its session events under `usage`:
     - `inputTokens`: New prompt, workspace context, and tool results.
     - `outputTokens`: Generated completion tokens.
     - `cacheReadTokens`: Prompt caching hits (e.g. Anthropic/OpenAI prompt cache).
     - `cacheWriteTokens`: Tokens written to prompt cache.
2. **Effective Turn Context**:
   - The active context footprint occupying the model's memory for that turn is:
     $$\text{Active Context Tokens} = \text{inputTokens} + \text{cacheReadTokens}$$
3. **Model Limit Mapping**:
   - Model limits resolve dynamically based on the model specified in `model`:
     - `claude-3-5-sonnet` / `claude-3-7-sonnet`: **200,000** tokens.
     - `gpt-4o`: **128,000** tokens.
     - `gpt-5`: **400,000** tokens.
     - `deepseek-v3` / `deepseek-r1`: **128,000** tokens.
     - `gemini-2.0-flash` / `gemini-2.5-pro`: **1,048,576** tokens.

---

## 2. Storage & Session Log Internals (`~/.commandcode/sessions/`)

### 2.1. File Location & Structure
Session logs are stored as JSONL files in the user's home directory:
```bash
~/.commandcode/sessions/<session_id>.jsonl
```

### 2.2. Session Event Schema
Each line represents an event. The message response event records:

```json
{
  "type": "message",
  "sessionId": "ses_98fbc102",
  "cwd": "/Users/username/dev/terax-ai",
  "model": "claude-3-5-sonnet",
  "usage": {
    "inputTokens": 1450,
    "outputTokens": 320,
    "cacheReadTokens": 48200,
    "cacheWriteTokens": 3100
  },
  "timestamp": 1756890300000
}
```

---

## 3. Mathematical Formula for Context Window Percentage

$$\text{Active Context Tokens} = \text{usage.inputTokens} + \text{usage.cacheReadTokens}$$

$$\% \text{ Context Window} = \left( \frac{\text{Active Context Tokens}}{\text{Model Context Window}} \right) \times 100\%$$

---

## 4. In-App Commands & Interactive Monitoring

Inside an active Command Code session:
- **Status Bar**: The interactive bottom feed dynamically shows the active model, token counter, and current mode.
- **`/cost`**: Breaks down API token expenditure and prompt caching savings.
- **`/compact`**: Manually condenses context history.

---

## 5. Production Extraction Scripts

### 5.1. Standalone Python Script

```python
#!/usr/bin/env python3
import os
import glob
import json

def get_command_code_context_status(target_cwd=None):
    if not target_cwd:
        target_cwd = os.getcwd()

    home = os.path.expanduser("~")
    sessions_dir = os.path.join(home, ".commandcode", "sessions")
    if not os.path.exists(sessions_dir):
        print("No Command Code sessions directory found.")
        return

    files = glob.glob(os.path.join(sessions_dir, "*.jsonl"))
    if not files:
        print("No Command Code session files found.")
        return

    # Sort descending by modification time
    files.sort(key=os.path.getmtime, reverse=True)

    KNOWN_LIMITS = {
        "claude-3-5-sonnet": 200000,
        "claude-3-7-sonnet": 200000,
        "claude-opus": 200000,
        "gpt-4o": 128000,
        "gpt-5": 400000,
        "deepseek-v3": 128000,
        "deepseek-r1": 128000,
        "gemini-2.0-flash": 1048576,
        "gemini-2.5-pro": 1048576,
    }

    latest_event = None
    matched_file = None

    for fpath in files[:20]:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                lines = f.readlines()
                # Check for matching cwd
                for line in reversed(lines):
                    data = json.loads(line)
                    if data.get("type") == "message" and "usage" in data:
                        cwd = data.get("cwd")
                        if cwd and os.path.abspath(cwd) == os.path.abspath(target_cwd):
                            latest_event = data
                            matched_file = fpath
                            break
                if latest_event:
                    break
        except Exception:
            continue

    # Fallback to absolute newest if no cwd match
    if not latest_event and files:
        matched_file = files[0]
        with open(matched_file, "r", encoding="utf-8") as f:
            for line in reversed(f.readlines()):
                try:
                    data = json.loads(line)
                    if data.get("type") == "message" and "usage" in data:
                        latest_event = data
                        break
                except Exception:
                    continue

    if not latest_event:
        print("No turn usage found in Command Code sessions.")
        return

    model = latest_event.get("model", "claude-3-5-sonnet")
    usage = latest_event.get("usage", {})
    inp = usage.get("inputTokens", 0)
    cache_read = usage.get("cacheReadTokens", 0)
    out = usage.get("outputTokens", 0)

    active_tokens = inp + cache_read
    max_context = KNOWN_LIMITS.get(model, 200000)
    percentage = (active_tokens / max_context) * 100

    print("========================================")
    print(f"Agent          : Command Code CLI")
    print(f"Session Log    : {os.path.basename(matched_file)}")
    print(f"Model          : {model}")
    print(f"Active Tokens  : {active_tokens:,} / {max_context:,}")
    print(f"  - Input      : {inp:,}")
    print(f"  - Cache Read : {cache_read:,}")
    print(f"  - Output     : {out:,}")
    print(f"👉 Context %   : {percentage:.1f}%")
    print("========================================")

if __name__ == "__main__":
    get_command_code_context_status()
```

---

### 5.2. Rust Native Integration (cmdSpace Bridge)

```rust
// Matches parser contract in cmdSpace `src-tauri/src/modules/agent_usage_parsers.rs`
pub fn parse_cmd_context(line: &str) -> Option<(u64, String, u8)> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    if value.get("type").and_then(|v| v.as_str()) == Some("session") {
        return None;
    }
    
    let usage = value.get("usage")?;
    let input = usage.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let cache_read = usage.get("cacheReadTokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let active_tokens = input + cache_read;
    
    let model = value.get("model").and_then(|v| v.as_str())?;
    if active_tokens == 0 || model.is_empty() {
        return None;
    }

    let max_context = if model.contains("gpt-4o") {
        128_000
    } else if model.contains("gemini") {
        1_048_576
    } else {
        200_000
    };

    let percentage = ((active_tokens * 100) / max_context) as u8;
    Some((active_tokens, model.to_string(), percentage))
}
```
