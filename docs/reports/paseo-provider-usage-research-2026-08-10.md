# Paseo provider Usage research

Research date: 2026-08-10. Primary source: local first-party Paseo checkout at commit `3d420720c` (`main`).

## What the feature is

**Evidence.** Paseo's Usage feature reports **provider plan/quota state**, not an aggregate spend or token report for all running agents. It is exposed at **Settings → Host → Usage** and inside the active agent's context-meter tooltip. The settings navigation and route are in `paseo/packages/app/src/screens/settings-screen.tsx:173-205`; the two render entrypoints are `paseo/packages/app/src/screens/settings/host-page.tsx:333-349` and `paseo/packages/app/src/components/context-window-meter.tsx:108-125` with `paseo/packages/app/src/provider-usage/tooltip-section.tsx:16-55`.

**Evidence.** The normalised contract is provider-oriented: identity/display name/status/plan plus independent `windows`, `balances`, and `details`; it has no cross-provider total field. See `paseo/packages/protocol/src/messages.ts:5118-5154` and `paseo/packages/app/src/provider-usage/card.tsx:41-121`.

**Inference.** cmdSpace should present this as “Plan usage” or “Provider limits”, separately from per-terminal/session token and cost telemetry. Combining them would imply a total that Paseo deliberately does not compute.

## Data flow and computation

**Evidence.** The client requests `provider.usage.list.request`; the daemon returns `provider.usage.list.response` through the provider session. The client RPC is in `paseo/packages/client/src/daemon-client.ts:4657-4669`, the protocol schemas are `paseo/packages/protocol/src/messages.ts:1380-1388, 5138-5151`, and daemon handling is `paseo/packages/server/src/server/session/provider/provider-catalog-session.ts:480-503`.

**Evidence.** `ProviderUsageService` runs all registered provider fetchers concurrently with `Promise.allSettled`. A failed provider becomes an `error`/`unavailable` record without hiding successful providers; results retain manifest order. See `paseo/packages/server/src/services/quota-fetcher/service.ts:42-88`.

**Evidence.** Each fetcher parses a provider response with Zod and maps it into generic bars:

- **Claude:** session, weekly, and scoped model/surface weekly limits; authenticates from `.claude/.credentials.json` or macOS Keychain and can refresh a file-backed OAuth token. `paseo/packages/server/src/services/quota-fetcher/providers/claude.ts:315-505`.
- **Codex:** session, weekly, code-review windows and optional USD credits; reads Codex `auth.json`, sends `ChatGPT-Account-Id` when present, and can refresh OAuth. `paseo/packages/server/src/services/quota-fetcher/providers/codex.ts:92-280`.
- **Copilot:** plan and quota-reset detail only, from environment variables or GitHub CLI credentials. `paseo/packages/server/src/services/quota-fetcher/providers/copilot.ts:20-98`.
- **Cursor:** current billing-cycle USD balance from its app SQLite credential store or environment. `paseo/packages/server/src/services/quota-fetcher/providers/cursor.ts:73-180`.
- **Grok, Kimi, MiniMax, Z.ai:** credits/monthly balance, coding-usage window, per-model interval/weekly windows, and subscription details respectively. `paseo/packages/server/src/services/quota-fetcher/providers/{grok,kimi,minimax,zai}.ts`.

**Evidence.** The manifest currently registers eight fetchers: Claude, Codex, Copilot, Cursor, Z.ai, Grok, Kimi, and MiniMax. `paseo/packages/server/src/services/quota-fetcher/manifest.ts:15-61`. The shared 15-second HTTP timeout, percentage/tone helpers, and unavailable result live in `paseo/packages/server/src/services/quota-fetcher/usage.ts:9-100`.

**Evidence.** UI bars compute a percentage only when a limit is known; balances otherwise show “left” or a raw amount. The UI clamps percent to 0–100 and formats reset time relatively. `paseo/packages/app/src/provider-usage/{window-bar,balance-bar,format,tone}.tsx`.

## Refresh, cache, errors, persistence

**Evidence.** Both daemon and React Query cache for five minutes. The daemon retains one in-memory result and coalesces concurrent misses; the app query is keyed by host/server ID, disables reconnect/focus refetch, and gates calls on a negotiated `providerUsageList` capability. `paseo/packages/server/src/services/quota-fetcher/service.ts:20-65`; `paseo/packages/app/src/provider-usage/use-provider-usage.ts:9-102`; `paseo/packages/server/src/server/websocket-server.ts:1558-1568`.

**Evidence.** The settings Refresh button invalidates the **client** query and refetches the RPC. The current RPC calls `listUsage()` without `forceRefresh`, so it may still receive the daemon's five-minute cached snapshot. `paseo/packages/app/src/provider-usage/use-provider-usage.ts:60-68` and `paseo/packages/server/src/server/session/provider/provider-catalog-session.ts:480-488`.

**Evidence.** Usage data is not written to a database or durable client store in the referenced feature paths: search finds only the in-memory service cache and React Query use. The service is constructed once with the WebSocket server. `paseo/packages/server/src/server/websocket-server.ts:689-691`.

**Inference.** cmdSpace should make “Refresh” semantics explicit: either implement a native `force` option that bypasses the service cache, or label the action “Reload cached usage”. It should keep the cache in memory first; SQLite persistence adds stale-account and credential-change invalidation problems without benefiting a quota view.

## Reuse recommendation for cmdSpace

1. Reuse the **generic model**: provider ID/status/plan, labelled windows, balances, details, fetched timestamp, and per-provider failure isolation.
2. Reuse the **service shape**: a manifest of independent adapters, concurrent settlement, bounded timeout, a single in-flight request, and short memory TTL. Put it behind the existing Tauri bridge rather than a WebSocket protocol.
3. Reuse the **two UI surfaces**: a complete Settings list plus compact contextual usage beside the active agent, sharing one card/bar renderer.
4. Do **not** copy provider credential scraping or undocumented endpoints unchanged. Treat those as provider-specific compatibility code; prefer documented APIs and cmdSpace's existing OS-keychain boundary. If CLI credential reuse is required, make it opt-in and keep refresh-token writes narrowly scoped.
5. Start with Codex and Claude, because their normalised windows map cleanly to the current CLI-agent support; add adapters only when a provider exposes a stable, authorised source.

## Limits of this research

This is source-level research only. No Paseo daemon was started and no provider endpoint was called, so endpoint availability and account-specific response shapes were not independently validated.
