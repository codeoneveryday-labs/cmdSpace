# Terminal AI Agents: Context Window & Token Telemetry Architecture

> **Master Architecture Guide**: Unified specification for monitoring, extracting, and calculating real-time Context Window utilization across all primary terminal coding agents supported in cmdSpace.

---

## 1. Cross-Agent Comparative Matrix

| Agent | Executable | Local Session Storage | Payload Format | Native Limit Field | Default Context Window | Dedicated Guide |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenCode** | `opencode` | `~/.local/share/opencode/opencode.db` | SQLite (`message.data` JSON) | Look up via `models.dev` | 1,048,576 (Muse) / 200k (Claude) | [OpenCode Guide](OPENCODE_CONTEXT_WINDOW.md) |
| **Claude Code** | `claude` | `~/.claude/projects/<escaped_cwd>/*.jsonl` | JSONL stream | Look up by model string | 200,000 (Sonnet) / 1M (Tier) | [Claude Guide](CLAUDE_CONTEXT_WINDOW.md) |
| **OpenAI Codex** | `codex` | `~/.codex/sessions/YYYY/MM/DD/*.jsonl` | JSONL stream | Emitted: `model_context_window` | 128,000 (GPT-4o) / 1M (GPT-5) | [Codex Guide](CODEX_CONTEXT_WINDOW.md) |
| **Command Code** | `cmd` / `cmdc` | `~/.commandcode/sessions/*.jsonl` | JSONL stream | Look up by model string | 200,000 (Claude) / 128k (GPT-4o) | [Command Code Guide](COMMAND_CODE_CONTEXT_WINDOW.md) |
| **OMP** | `omp` | `~/.omp/sessions/*.jsonl` | JSONL stream | Emitted or `model_cache` | 200,000 (Claude) / 1M (Gemini) | [OMP Guide](OMP_CONTEXT_WINDOW.md) |
| **Gemini CLI** | `gemini` | `~/.gemini/sessions/*.json` | JSON / JSONL | Look up by model string | 1,048,576 (Pro/Flash) / 2M | [Gemini Guide](GEMINI_CONTEXT_WINDOW.md) |

---

## 2. Universal Context Calculation Invariant

Modern frontier coding agents operate with **Prompt Caching**. To calculate the exact fraction of the model's active attention window currently occupied:

### 2.1. The Standard Formula

$$\text{Active Tokens} = \text{Uncached Input Tokens} + \text{Cached Input Tokens}$$

$$\% \text{ Context Window} = \left( \frac{\text{Active Tokens}}{\text{Max Model Context Window}} \right) \times 100\%$$

### 2.2. Token Field Mapping by Provider

| Provider / Engine | Uncached Input Key | Cached Input Key | Output Tokens Key | Total Active Context |
| :--- | :--- | :--- | :--- | :--- |
| **OpenCode** | `tokens.input` | `tokens.cache.read` | `tokens.output` | `input + cache.read` |
| **Claude Code** | `input_tokens` | `cache_read_input_tokens` | `output_tokens` | `input + cache_read + cache_create` |
| **Codex CLI** | `input_tokens` | *(Included in total)* | `output_tokens` | `last_token_usage.total_tokens` |
| **Command Code** | `usage.inputTokens` | `usage.cacheReadTokens` | `usage.outputTokens` | `inputTokens + cacheReadTokens` |
| **OMP** | `usage.input` | `usage.cacheRead` | `usage.output` | `usage.totalTokens` (or `input + cacheRead`) |
| **Gemini CLI** | `promptTokenCount` | `cachedContentTokenCount` | `candidatesTokenCount` | `promptTokenCount` |

---

## 3. Pitfalls & Anti-Patterns to Avoid

1. **Do NOT Use Cumulative Session Totals**:
   - In SQLite databases (e.g. OpenCode's `session.tokens_input`), the column stores the cumulative token sum across all turns in the session history (can reach 100M+ tokens).
   - Always query the **turn-level event** for the active context window.
2. **Handle In-Flight Turns**:
   - Only evaluate assistant turns that have completed generation (e.g. `finish` marker present in OpenCode). In-flight streams report partial or zeroed counters.
3. **Model Name Matching Precedence**:
   - Substring matching must prioritize specific variants before general prefixes (e.g., match `gemini-2.0-flash` before `gemini`, or `claude-3-7-sonnet` before `claude`).

---

## 4. Documentation Directory

- 📘 [OpenCode Context Window Guide](OPENCODE_CONTEXT_WINDOW.md)
- 📙 [Claude Code Context Window Guide](CLAUDE_CONTEXT_WINDOW.md)
- 📗 [OpenAI Codex Context Window Guide](CODEX_CONTEXT_WINDOW.md)
- 📕 [Command Code Context Window Guide](COMMAND_CODE_CONTEXT_WINDOW.md)
- 📓 [OMP (Oh-My-Pi) Context Window Guide](OMP_CONTEXT_WINDOW.md)
- 📓 [Gemini CLI Context Window Guide](GEMINI_CONTEXT_WINDOW.md)
