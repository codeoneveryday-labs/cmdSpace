# OpenCode CLI Agent: Context Window Monitoring, Data Extraction & Calculation Guide

> **Engineering Reference**: Technical specification and implementation guide for inspecting, extracting, and calculating real-time Context Window utilization in OpenCode sessions.

---

## 1. Context Window Architecture in OpenCode

### 1.1. Core Invariants
OpenCode (`opencode`) manages LLM context across three layers:

1. **Maximum Context Window (`limit.context`)**:
   - The absolute token capacity accepted by a model in a single request.
   - Sourced centrally from [Models.dev](https://models.dev/api.json) and cached locally at `~/.cache/opencode/models.json` (or `~/.local/share/opencode/models.json`).
   - Defined under the model's `limit.context` property in tokens.

2. **Active Context Consumption**:
   - The active prompt payload submitted to the LLM during the latest turn, comprising the system prompt, tool definitions, full conversation history, file attachments, and latest user prompt.
   - When Prompt Caching is utilized (Anthropic, OpenCode, OpenAI, Gemini), this payload is split into `cache.read` (cached tokens) and `input` (new tokens).

3. **Auto-Compaction**:
   - Monitored internally via `compaction.ts` and `overflow.ts`.
   - By default, compaction triggers when token consumption nears **95%** of `limit.context` (or when the remaining headroom drops below a safety buffer of ~20,000 tokens).

---

## 2. Storage & SQLite Schema (`~/.local/share/opencode/opencode.db`)

OpenCode maintains its state in a local SQLite database located at:
```bash
~/.local/share/opencode/opencode.db
```

### 2.1. The `session` Table
Stores high-level session metadata:
- `id`: Session primary key (e.g. `ses_066a...`).
- `title`: Human-readable session title (e.g. `"New session - 2026-09-03..."`).
- `directory`: Absolute path of the project workspace.
- `time_updated`: Epoch millisecond timestamp of last activity.
- `tokens_input`, `tokens_output`: **Caution**: These columns record the **cumulative sum** across every turn in the session lifecycle. They do **not** reflect the active context size of the current turn.

### 2.2. The `message` Table
Stores individual message turns:
- `id`: Message primary key.
- `session_id`: Foreign key referencing `session(id)`.
- `time_created`: Timestamp of message generation.
- `data`: Serialized JSON payload containing turn metadata and token counts.

For assistant responses (`role: "assistant"`), `data` contains:
```json
{
  "role": "assistant",
  "providerID": "opencode",
  "modelID": "muse-spark-1.3-contributor-free",
  "tokens": {
    "input": 529,
    "output": 110,
    "reasoning": 0,
    "cache": {
      "read": 477937,
      "write": 0
    }
  }
}
```

---

## 3. Mathematical Formula for Context Window Percentage

When prompting modern frontier models with prompt caching enabled:
- `tokens.cache.read`: Context previously processed and cached in GPU/server memory.
- `tokens.input`: New tokens introduced in the current turn.

$$\text{Active Context Tokens} = \text{tokens.input} + \text{tokens.cache.read}$$

$$\% \text{ Context Window} = \left( \frac{\text{Active Context Tokens}}{\text{limit.context}} \right) \times 100\%$$

---

## 4. Reference: Context Window Limits by Model

| Provider | Model Identifier | Max Context Window (`limit.context`) |
| :--- | :--- | :--- |
| **OpenCode** | `opencode/muse-spark-1.3-contributor-free` | **1,048,576** tokens (~1M) |
| **OpenCode** | `opencode/muse-spark-1.2-contributor-free` | **1,048,576** tokens (~1M) |
| **Anthropic** | `anthropic/claude-3-5-sonnet` | **200,000** tokens |
| **Anthropic** | `anthropic/claude-3-7-sonnet` | **200,000** tokens |
| **Anthropic** | `anthropic/claude-opus-4.5` | **200,000** tokens (up to 1M depending on tier) |
| **OpenAI** | `openai/gpt-4o` | **128,000** tokens |
| **OpenAI** | `openai/gpt-5` | **1,048,576** tokens |
| **Google** | `google/gemini-2.0-flash` / `2.5-pro` | **1,048,576** tokens |
| **DeepSeek** | `deepseek/deepseek-v3` / `deepseek-r1` | **128,000** tokens |

*(Official model limits are maintained live at `https://models.dev/api.json`)*.

---

## 5. Verified Empirical Example

Extracted directly from an active OpenCode session:

- **Session**: `"New session - 2026-09-03T06:29:43.890Z"`
- **Model**: `opencode/muse-spark-1.3-contributor-free`
- **Latest Turn Tokens**:
  - `tokens.input`: `529`
  - `tokens.cache.read`: `477,937`
  - $\rightarrow \text{Active Tokens} = 529 + 477,937 = \mathbf{478,466} \text{ tokens}$
- **Model Capacity (`limit.context`)**: `1,048,576` tokens ($1024 \times 1024$)
- **Calculation**:
  $$\frac{478,466}{1,048,576} \times 100\% = \mathbf{45.6\%}$$

---

## 6. Extraction Scripts

### 6.1. Standalone Python CLI Tool

Run this script directly in macOS/Linux terminal to display real-time context statistics:

```python
#!/usr/bin/env python3
import sqlite3
import os
import json

def get_opencode_context_status():
    db_path = os.path.expanduser("~/.local/share/opencode/opencode.db")
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cursor = conn.cursor()

    # Standard model context window dictionary
    CONTEXT_LIMITS = {
        "opencode/muse-spark-1.3-contributor-free": 1048576,
        "opencode/muse-spark-1.2-contributor-free": 1048576,
        "anthropic/claude-3-5-sonnet": 200000,
        "anthropic/claude-3-7-sonnet": 200000,
        "openai/gpt-4o": 128000,
        "openai/gpt-5": 1048576,
    }

    # 1. Fetch latest session
    cursor.execute("""
        SELECT id, title, directory, time_updated 
        FROM session 
        ORDER BY time_updated DESC LIMIT 1
    """)
    session = cursor.fetchone()
    if not session:
        print("No active session found.")
        return

    session_id, title, directory, _ = session

    # 2. Fetch latest assistant message for token metrics
    cursor.execute("""
        SELECT data FROM message 
        WHERE session_id = ? 
        ORDER BY time_created DESC
    """, (session_id,))
    messages = cursor.fetchall()

    latest_tokens = None
    model_identifier = "unknown"

    for (raw_json,) in messages:
        try:
            msg = json.loads(raw_json)
            if msg.get("role") == "assistant" and "tokens" in msg:
                t = msg["tokens"]
                if t.get("input", 0) > 0 or t.get("cache", {}).get("read", 0) > 0:
                    latest_tokens = t
                    model_identifier = f"{msg.get('providerID')}/{msg.get('modelID')}"
                    break
        except Exception:
            continue

    if not latest_tokens:
        print(f"Session '{title}' has no completed assistant turns yet.")
        return

    # 3. Compute percentage
    inp = latest_tokens.get("input", 0)
    cache_read = latest_tokens.get("cache", {}).get("read", 0)
    used_tokens = inp + cache_read

    max_context = CONTEXT_LIMITS.get(
        model_identifier,
        1048576 if "muse" in model_identifier else 200000
    )

    percentage = (used_tokens / max_context) * 100

    print("========================================")
    print(f"Session     : {title}")
    print(f"Directory   : {directory}")
    print(f"Model       : {model_identifier}")
    print(f"Used Tokens : {used_tokens:,} (Input: {inp:,} + Cache: {cache_read:,})")
    print(f"Max Context : {max_context:,} tokens")
    print(f"Context %   : {percentage:.1f}%")
    print("========================================")

if __name__ == "__main__":
    get_opencode_context_status()
```

---

### 6.2. TypeScript / Node.js Bridge Integration

For embedding into desktop applications (such as cmdSpace or Electron/Tauri bridge):

```typescript
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";

export interface ContextWindowReport {
  sessionId: string;
  title: string;
  model: string;
  usedTokens: number;
  maxContext: number;
  percentage: number;
}

export function getLatestOpenCodeContext(): ContextWindowReport | null {
  const dbPath = path.join(os.homedir(), ".local/share/opencode/opencode.db");
  const db = new Database(dbPath, { readonly: true });

  const session = db
    .prepare("SELECT id, title FROM session ORDER BY time_updated DESC LIMIT 1")
    .get() as { id: string; title: string } | undefined;

  if (!session) return null;

  const messages = db
    .prepare("SELECT data FROM message WHERE session_id = ? ORDER BY time_created DESC")
    .all(session.id) as { data: string }[];

  for (const row of messages) {
    const msg = JSON.parse(row.data);
    if (msg.role === "assistant" && msg.tokens) {
      const input = msg.tokens.input ?? 0;
      const cacheRead = msg.tokens.cache?.read ?? 0;
      const usedTokens = input + cacheRead;

      if (usedTokens > 0) {
        const model = `${msg.providerID}/${msg.modelID}`;
        const maxContext = model.includes("muse") ? 1_048_576 : 200_000;
        const percentage = Number(((usedTokens / maxContext) * 100).toFixed(1));

        return {
          sessionId: session.id,
          title: session.title,
          model,
          usedTokens,
          maxContext,
          percentage,
        };
      }
    }
  }

  return null;
}
```

---

## 7. Custom Overrides via `opencode.jsonc`

To force custom context limits or preemptive auto-compaction for private models:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "my-custom-provider": {
      "models": {
        "custom-model": {
          "limit": {
            "context": 128000,
            "output": 8192
          }
        }
      }
    }
  }
}
```
