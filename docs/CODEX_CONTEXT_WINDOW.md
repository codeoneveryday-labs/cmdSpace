# OpenAI Codex CLI: Context Window Monitoring, Token Extraction & Calculation Guide

> **Engineering Reference**: Technical specification and implementation guide for inspecting, extracting, and calculating real-time Context Window utilization and rate limits in OpenAI Codex CLI sessions.

---

## 1. Context Window Architecture in OpenAI Codex

### 1.1. Core Invariants
The OpenAI **Codex CLI** (`codex`) integrates directly with OpenAI's models (e.g., `gpt-4o`, `o1`, `o3-mini`, `gpt-5` series):

1. **Native Context Reporting (`model_context_window`)**:
   - Unlike agents that require external model registries, Codex CLI **natively emits** the exact model context limit in its session events under `model_context_window` (e.g., `128,000` or `1,048,576` tokens).
2. **Turn Token Accounting (`last_token_usage`)**:
   - Token consumption for the active turn is recorded in `last_token_usage`:
     - `input_tokens`: Prompt, instructions, and context tokens.
     - `output_tokens`: Completion and reasoning tokens.
     - `total_tokens`: Total active context window consumption for that turn.
3. **Built-in Rate Limit Telemetry (`rate_limits`)**:
   - Codex streams exact rate limit saturation directly in the session payload:
     - `primary`: Short-window rate limit (typically 1 hour / 60 minutes).
     - `secondary`: Long-window rate limit (typically 24 hours / daily cap).
     - `used_percent`: Percentage of current window capacity consumed.
     - `resets_at`: Epoch timestamp when quota refreshes.

---

## 2. Storage & Session Log Internals (`~/.codex/sessions/`)

Codex CLI persists state in date-partitioned JSONL files.

### 2.1. File Location & Directory Structure
```bash
~/.codex/sessions/YYYY/MM/DD/session-<timestamp>-<uuid>.jsonl
```
*Example: `~/.codex/sessions/2026/09/03/session-1756890200-abc12345.jsonl`.*

### 2.2. Session Event Payload Schema
Inside the session log, status and turn completion lines follow this JSON structure:

```json
{
  "type": "turn_complete",
  "payload": {
    "info": {
      "model": "gpt-4o",
      "model_context_window": 128000,
      "last_token_usage": {
        "input_tokens": 34200,
        "output_tokens": 1150,
        "total_tokens": 35350
      }
    },
    "rate_limits": {
      "primary": {
        "used_percent": 27.5,
        "window_minutes": 60,
        "resets_at": 1756893600
      },
      "secondary": {
        "used_percent": 11.0,
        "window_minutes": 1440,
        "resets_at": 1756920000
      }
    }
  }
}
```

---

## 3. Mathematical Formula for Context Window Percentage

$$\% \text{ Context Window} = \left( \frac{\text{last\_token\_usage.total\_tokens}}{\text{model\_context\_window}} \right) \times 100\%$$

$$\% \text{ Remaining Headroom} = 100\% - \% \text{ Context Window}$$

---

## 4. In-App Commands & Interactive Monitoring

Inside an active Codex CLI interactive session:
- **`/status`**: Prints the current model, active tokens, and remaining rate limit quotas.
- **`/compact`**: Triggers conversation history summarization.

---

## 5. Production Extraction Scripts

### 5.1. Standalone Python Script

```python
#!/usr/bin/env python3
import os
import glob
import json

def get_codex_context_status(target_cwd=None):
    if not target_cwd:
        target_cwd = os.getcwd()

    home = os.path.expanduser("~")
    sessions_root = os.path.join(home, ".codex", "sessions")
    if not os.path.exists(sessions_root):
        print("No Codex sessions directory found.")
        return

    # Find all session jsonl files recursively
    files = glob.glob(os.path.join(sessions_root, "*", "*", "*", "*.jsonl"))
    if not files:
        print("No Codex session logs found.")
        return

    # Sort by modification time descending
    files.sort(key=os.path.getmtime, reverse=True)

    # Find matching session for current cwd
    matched_file = None
    latest_status = None

    for fpath in files[:30]:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                lines = f.readlines()
                # Check first line for cwd
                if lines:
                    first_line = json.loads(lines[0])
                    cwd = first_line.get("cwd") or first_line.get("payload", {}).get("cwd")
                    if cwd and os.path.abspath(cwd) == os.path.abspath(target_cwd):
                        matched_file = fpath
                        # Scan backwards for status
                        for line in reversed(lines):
                            data = json.loads(line)
                            info = data.get("payload", {}).get("info")
                            if info and "model_context_window" in info:
                                latest_status = data.get("payload")
                                break
                        break
        except Exception:
            continue

    # Fallback to absolute newest session if no cwd match
    if not latest_status and files:
        matched_file = files[0]
        with open(matched_file, "r", encoding="utf-8") as f:
            for line in reversed(f.readlines()):
                try:
                    data = json.loads(line)
                    info = data.get("payload", {}).get("info")
                    if info and "model_context_window" in info:
                        latest_status = data.get("payload")
                        break
                except Exception:
                    continue

    if not latest_status:
        print("No active token metrics found in recent Codex sessions.")
        return

    info = latest_status.get("info", {})
    model = info.get("model", "unknown")
    context_window = info.get("model_context_window", 128000)
    token_usage = info.get("last_token_usage", {})
    total_tokens = token_usage.get("total_tokens", 0)

    percentage = (total_tokens / context_window) * 100 if context_window > 0 else 0
    rate_limits = latest_status.get("rate_limits", {})

    print("========================================")
    print(f"Agent          : OpenAI Codex CLI")
    print(f"Session Log    : {os.path.basename(matched_file)}")
    print(f"Model          : {model}")
    print(f"Active Tokens  : {total_tokens:,} / {context_window:,}")
    print(f"👉 Context %   : {percentage:.1f}%")
    if "primary" in rate_limits:
        print(f"Hourly Quota   : {rate_limits['primary'].get('used_percent', 0)}% used")
    if "secondary" in rate_limits:
        print(f"Daily Quota    : {rate_limits['secondary'].get('used_percent', 0)}% used")
    print("========================================")

if __name__ == "__main__":
    get_codex_context_status()
```

---

### 5.2. Rust Native Integration (cmdSpace Bridge)

```rust
// Matches parser contract in cmdSpace `src-tauri/src/modules/agent_usage_parsers.rs`
pub fn parse_codex_status(line: &str) -> Option<(u64, u64, u8)> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let info = value.pointer("/payload/info")?;
    
    let context_window = info
        .get("model_context_window")
        .or_else(|| value.pointer("/payload/model_context_window"))
        .and_then(serde_json::Value::as_u64)?;
        
    let context_tokens = info
        .pointer("/last_token_usage/total_tokens")
        .and_then(serde_json::Value::as_u64)?;

    let percentage = ((context_tokens * 100) / context_window) as u8;
    Some((context_tokens, context_window, percentage))
}
```
