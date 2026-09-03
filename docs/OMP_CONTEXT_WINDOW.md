# OMP (Oh-My-Pi) CLI: Context Window Monitoring, Token Extraction & Calculation Guide

> **Engineering Reference**: Technical specification and implementation guide for inspecting, extracting, and calculating real-time Context Window utilization in OMP (`omp` / `@oh-my-pi/pi-coding-agent`) sessions.

---

## 1. Context Window Architecture in OMP

### 1.1. Core Invariants
**OMP** (`omp`) is an ultra-fast coding agent built on a native Rust engine and Pi runtime. It manages context dynamically across configured model roles (`smol`, `slow`, `plan`):

1. **Native Token Metric Emitted in Usage**:
   - For each message turn, OMP records exact token consumption in its session log:
     - `input`: Prompt and workspace context tokens.
     - `output`: Model generation and tool calls.
     - `cacheRead`: Tokens loaded from provider prompt cache.
     - `cacheWrite`: Tokens newly written to cache.
     - `totalTokens`: Active turn context footprint (or max of the components).
2. **Context Window Resolution**:
   - OMP cross-references the active `model` against its internal model cache (`model_cache` or Models.dev format `[{id, contextWindow}]`):
     - Claude 3.5 / 3.7 Sonnet: **200,000** tokens.
     - GPT-4o: **128,000** tokens.
     - Gemini 2.0 / 2.5: **1,048,576** tokens.
     - Muse Spark: **1,048,576** tokens.

---

## 2. Storage & Session Log Internals (`~/.omp/sessions/`)

### 2.1. File Locations
Depending on the distribution and version, OMP logs sessions to:
```bash
~/.omp/sessions/<session_id>.jsonl
# Or legacy Pi storage:
~/.pi/agent/sessions/<session_id>.jsonl
```

### 2.2. Session Event Schema
Each line represents an event. Message response turns follow this structure:

```json
{
  "type": "turn_finish",
  "sessionId": "pi_session_4f9a...",
  "cwd": "/Users/username/dev/terax-ai",
  "model": "claude-3-5-sonnet",
  "usage": {
    "input": 1820,
    "output": 450,
    "cacheRead": 51200,
    "cacheWrite": 1900,
    "totalTokens": 53020
  },
  "timestamp": 1756890400000
}
```

---

## 3. Mathematical Formula for Context Window Percentage

$$\text{Active Context Tokens} = \text{usage.totalTokens} \quad (\text{or } \text{usage.input} + \text{usage.cacheRead})$$

$$\% \text{ Context Window} = \left( \frac{\text{Active Context Tokens}}{\text{model.contextWindow}} \right) \times 100\%$$

---

## 4. In-App Commands & Interactive Monitoring

Inside an active OMP session:
- **TUI Status Line**: Bottom bar displays active role (`smol`/`slow`), model name, and token counter.
- **`/model`**: Interactive role and model selector showing context window limits.
- **`/compact`**: Shrinks conversation history using the fast `smol` model.

---

## 5. Production Extraction Scripts

### 5.1. Standalone Python Script

```python
#!/usr/bin/env python3
import os
import glob
import json

def get_omp_context_status(target_cwd=None):
    if not target_cwd:
        target_cwd = os.getcwd()

    home = os.path.expanduser("~")
    # Check both ~/.omp/sessions and ~/.pi/agent/sessions
    candidate_dirs = [
        os.path.join(home, ".omp", "sessions"),
        os.path.join(home, ".pi", "agent", "sessions"),
    ]

    files = []
    for sdir in candidate_dirs:
        if os.path.exists(sdir):
            files.extend(glob.glob(os.path.join(sdir, "*.jsonl")))

    if not files:
        print("No OMP session files found.")
        return

    # Sort descending by modification time
    files.sort(key=os.path.getmtime, reverse=True)

    KNOWN_LIMITS = {
        "claude-3-5-sonnet": 200000,
        "claude-3-7-sonnet": 200000,
        "gpt-4o": 128000,
        "gpt-5": 400000,
        "deepseek-v3": 128000,
        "gemini-2.0-flash": 1048576,
        "gemini-2.5-pro": 1048576,
        "muse-spark": 1048576,
    }

    latest_event = None
    matched_file = None

    for fpath in files[:25]:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in reversed(lines):
                    data = json.loads(line)
                    if "usage" in data and "model" in data:
                        cwd = data.get("cwd")
                        if not cwd or os.path.abspath(cwd) == os.path.abspath(target_cwd):
                            latest_event = data
                            matched_file = fpath
                            break
                if latest_event:
                    break
        except Exception:
            continue

    if not latest_event:
        print("No valid turn usage found in recent OMP sessions.")
        return

    model = latest_event.get("model", "unknown")
    usage = latest_event.get("usage", {})
    
    # Active context tokens
    active_tokens = usage.get("totalTokens")
    if not active_tokens:
        active_tokens = usage.get("input", 0) + usage.get("cacheRead", 0)

    # Determine limit
    max_context = 200000
    for key, limit in KNOWN_LIMITS.items():
        if key in model.lower():
            max_context = limit
            break

    percentage = (active_tokens / max_context) * 100

    print("========================================")
    print(f"Agent          : OMP CLI")
    print(f"Session Log    : {os.path.basename(matched_file)}")
    print(f"Model          : {model}")
    print(f"Active Tokens  : {active_tokens:,} / {max_context:,}")
    print(f"  - Input      : {usage.get('input', 0):,}")
    print(f"  - Cache Read : {usage.get('cacheRead', 0):,}")
    print(f"  - Output     : {usage.get('output', 0):,}")
    print(f"👉 Context %   : {percentage:.1f}%")
    print("========================================")

if __name__ == "__main__":
    get_omp_context_status()
```

---

### 5.2. Rust Native Integration (cmdSpace Bridge)

```rust
// Matches parser contract in cmdSpace `src-tauri/src/modules/agent_usage_parsers.rs`
pub fn parse_omp_context(line: &str) -> Option<(u64, String, u8)> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let usage = value.get("usage")?;
    
    let input = usage.get("input").and_then(|v| v.as_u64()).unwrap_or(0);
    let cache_read = usage.get("cacheRead").and_then(|v| v.as_u64()).unwrap_or(0);
    let total = usage.get("totalTokens").and_then(|v| v.as_u64()).unwrap_or(input + cache_read);
    
    let model = value.get("model").and_then(|v| v.as_str())?;
    if total == 0 || model.is_empty() {
        return None;
    }

    let max_context = if model.contains("gpt-4o") {
        128_000
    } else if model.contains("gemini") || model.contains("muse") {
        1_048_576
    } else {
        200_000
    };

    let percentage = ((total * 100) / max_context) as u8;
    Some((total, model.to_string(), percentage))
}
```
