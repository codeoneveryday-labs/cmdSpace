# Gemini CLI: Context Window Monitoring, Token Extraction & Calculation Guide

> **Engineering Reference**: Technical specification and implementation guide for inspecting, extracting, and calculating real-time Context Window utilization in Google Gemini CLI (`gemini` / `@google/gemini-cli`) sessions.

---

## 1. Context Window Architecture in Gemini CLI

### 1.1. Core Invariants
**Gemini CLI** (`gemini`) is powered by Google's Gemini models (Gemini 2.0 Flash, Gemini 2.5 Pro, Gemini 3.0):

1. **Massive Context Window Capacity**:
   - Standard Gemini 2.0 Flash / 2.5 Pro: **1,048,576 tokens** (1M context).
   - Gemini 1.5 Pro / Extended: Up to **2,097,152 tokens** (2M context).
2. **Context Cache (`cachedContentTokenCount`)**:
   - Gemini API supports explicit and automatic context caching for payloads exceeding 32k tokens.
   - The token payload separates:
     - `promptTokenCount`: Total input prompt tokens.
     - `cachedContentTokenCount`: Subset of prompt tokens served from persistent cache.
     - `candidatesTokenCount`: Model output/generated tokens.
     - `totalTokenCount`: Total combined tokens processed in the turn.
3. **Active Context Calculation**:
   - The prompt footprint occupying the model's window is:
     $$\text{Active Context Tokens} = \text{promptTokenCount}$$
   *(When cached content is reported separately in API metadata, $\text{promptTokenCount} + \text{cachedContentTokenCount}$).*

---

## 2. Storage & Session Log Internals (`~/.gemini/`)

Gemini CLI stores session logs and shadow Git checkpoint history under:
```bash
~/.gemini/sessions/<session_id>.json
# Or shadow Git checkpoints:
~/.gemini/history/<project_hash>/
```

### 2.1. Session Event Schema
Turn response events record usage metadata conforming to Google Generative AI metrics:

```json
{
  "type": "model_turn",
  "sessionId": "gemini_ses_88a1b2",
  "model": "gemini-2.5-pro",
  "usageMetadata": {
    "promptTokenCount": 68400,
    "candidatesTokenCount": 850,
    "cachedContentTokenCount": 45000,
    "totalTokenCount": 69250
  },
  "timestamp": 1756890500000
}
```

---

## 3. Mathematical Formula for Context Window Percentage

$$\% \text{ Context Window} = \left( \frac{\text{usageMetadata.promptTokenCount}}{1,048,576} \right) \times 100\%$$

*(Due to Gemini's 1M-2M token window, long sessions rarely exceed 15-20% capacity)*.

---

## 4. In-App Commands & Interactive Monitoring

Inside an active Gemini CLI session:
- **`/cost`**: Shows token usage and credit/billing estimates.
- **`/model`**: Switches between Flash (speed/cost) and Pro (deep reasoning/large context).
- **`/restore`**: Rewinds files without losing context via shadow Git checkpoints.

---

## 5. Production Extraction Scripts

### 5.1. Standalone Python Script

```python
#!/usr/bin/env python3
import os
import glob
import json

def get_gemini_context_status():
    home = os.path.expanduser("~")
    sessions_dir = os.path.join(home, ".gemini", "sessions")
    if not os.path.exists(sessions_dir):
        print("No Gemini CLI sessions directory found.")
        return

    files = glob.glob(os.path.join(sessions_dir, "*.json*"))
    if not files:
        print("No Gemini CLI session logs found.")
        return

    # Sort descending by modification time
    files.sort(key=os.path.getmtime, reverse=True)
    newest_file = files[0]

    latest_usage = None
    model_name = "gemini-2.5-pro"

    try:
        with open(newest_file, "r", encoding="utf-8") as f:
            content = f.read()
            # Support either full JSON or JSONL format
            if content.strip().startswith("["):
                events = json.loads(content)
                for ev in reversed(events):
                    if "usageMetadata" in ev:
                        latest_usage = ev["usageMetadata"]
                        model_name = ev.get("model", model_name)
                        break
            else:
                for line in reversed(content.splitlines()):
                    try:
                        ev = json.loads(line)
                        if "usageMetadata" in ev:
                            latest_usage = ev["usageMetadata"]
                            model_name = ev.get("model", model_name)
                            break
                    except Exception:
                        continue
    except Exception as e:
        print(f"Error reading Gemini session: {e}")
        return

    if not latest_usage:
        print("No usage metadata found in recent Gemini sessions.")
        return

    prompt_tokens = latest_usage.get("promptTokenCount", 0)
    cached_tokens = latest_usage.get("cachedContentTokenCount", 0)
    output_tokens = latest_usage.get("candidatesTokenCount", 0)
    max_context = 2097152 if "1.5-pro" in model_name else 1048576

    active_tokens = prompt_tokens
    percentage = (active_tokens / max_context) * 100

    print("========================================")
    print(f"Agent          : Google Gemini CLI")
    print(f"Session Log    : {os.path.basename(newest_file)}")
    print(f"Model          : {model_name}")
    print(f"Active Tokens  : {active_tokens:,} / {max_context:,}")
    print(f"  - Cached     : {cached_tokens:,}")
    print(f"  - Output     : {output_tokens:,}")
    print(f"👉 Context %   : {percentage:.2f}%")
    print("========================================")

if __name__ == "__main__":
    get_gemini_context_status()
```

---

### 5.2. Rust Native Integration (cmdSpace Bridge)

```rust
pub fn parse_gemini_context(json_payload: &str) -> Option<(u64, u8)> {
    let value: serde_json::Value = serde_json::from_str(json_payload).ok()?;
    let usage = value.get("usageMetadata")?;
    
    let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64())?;
    let max_context = 1_048_576; // 1M tokens standard
    
    let percentage = ((prompt_tokens * 100) / max_context) as u8;
    Some((prompt_tokens, percentage))
}
```
