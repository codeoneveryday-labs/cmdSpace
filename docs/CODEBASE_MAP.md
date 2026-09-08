# CODEBASE MAP — cmdSpace (`terax-ai`)

> Tài liệu onboarding do agent sinh ra sau khi đọc toàn bộ repo (2026-09-08).
> Mục đích: cho người mới (hoặc agent) biết **đọc cái gì, theo thứ tự nào, và
> chỗ nào đang có vấn đề**.
>
> Nguồn chân lý vẫn là `CMDSPACE.md`, `COMPREHENSIVE_PLAN.md`,
> `docs/architecture/design-patterns.md`. File này là bản đồ kiến trúc, không
> thay thế các tài liệu nguồn chân lý.

---

## Snapshot status — authoritative

| | |
|---|---|
| **Nguồn đo** | **Clean committed tree**, measured from `git archive` |
| **Thời điểm** | 2026-09-08 18:10 (GMT+7) |
| **Pinned commit** | `82e439a8cdd88036252d18e52a56aed18c57a6e5` (`82e439a8c`) |
| **Branch** | `chore/398-add-ecc-project-skills` |
| **Tree status after measurement** | 3 deliberate documentation/WIP modifications; no code changes |

All KPI figures in this map use the same canonical scope as the engineering
capability plan: frontend tests under `src/` only. The orchestration feature was
intentionally removed and committed in `fd4a61f81`; the CLI catalog pruning was
committed in `82e439a8c`.

| Metric | At `82e439a8c` |
|---|---:|
| Test files (`src/`) | **479** |
| `*.source.test.ts` | **280** |
| Executable test files | **199 (41.5%)** |
| File `.rs` (`src-tauri/src`) | **185** |
| Rust LOC | **30,444** |
| `src` production LOC | **67,653** |
| Registered Tauri commands | **117** |
| Orchestration feature | **removed** |

For KPI work, use this map and the plan only when the referenced SHA matches.
The plan provides the detailed taxonomy and reproduce commands.

**A12 is resolved.** The previous working-tree snapshot and orchestration
section were stale after the intentional removal. This file now describes the
post-removal tree at `82e439a8c`.

---

---

## 0. TL;DR — 6 điều phải nhớ

1. **Two-process model.** Webview (React) **không bao giờ** chạm filesystem /
   process / shell / keychain. Mọi thứ privileged đi qua `invoke()` tới một
   Rust command đăng ký trong `src-tauri/src/commands.rs`.
2. **App.tsx là coordinator.** ~1.367 LOC. Nó giữ UI flags + imperative refs,
   *không* giữ tab/workspace state (xem §3).
3. **Terminal có 2 đường đời khác nhau**: terminal thường → renderer pool +
   session map; canvas terminal → mỗi node có xterm + PTY riêng. Đừng trộn.
4. **Snapshot chỉ chứa metadata** — không bao giờ chứa PTY/process handle sống.
5. **Orchestration canvas đã bị loại bỏ có chủ đích** trong `fd4a61f81`; không
   khôi phục các module, command, UI hoặc plan đã xóa. Những hạng mục còn lại
   trong §7 là các rủi ro độc lập.
6. **Product là `cmdSpace`, thư mục là `terax-ai`**, bundle id
   `app.tranhoangpich.cmdspace`, package `cmdspace` v0.7.105. Đừng bối rối.

---

## 1. Tech stack (đã verify từ code)

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.8, Tailwind v4 (`@tailwindcss/vite`) |
| State | **chỉ 2 Zustand store** (`preferences`, `workspace env`) + `useState` trong hooks |
| Terminal | xterm.js 6 (WebGL) + renderer pool (12 instances) + PTY bridge |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`), vim mode |
| AI | Vercel AI SDK v6 (`ai` + `@ai-sdk/*`), BYOK đa provider |
| UI kit | shadcn/ui 24 component (`src/components/ui/`), style `radix-luma`, base `mist`, icon `hugeicons` |
| Backend | Tauri 2, Rust edition 2021, `portable-pty` 0.9, `rusqlite` bundled, `keyring`, `tungstenite`, `reqwest` |
| Test | Vitest (chạy qua `vite.config.ts`, **không có** `vitest.config.*`, **không có** jsdom) + Rust `#[cfg(test)]` |
| Animation / layout | `motion` (Framer Motion successor), `react-resizable-panels` |

---

## 2. Quy mô thực tế (đo ngày 2026-09-08)

| Khu vực | File | LOC | Ghi chú |
|---|---|---|---|
| `src/` **production** | 592 | 67.807 | `.ts`/`.tsx`, trừ test |
| `src/` **test** | 479 | 24.229 | tỉ lệ test:prod ≈ **1:1.2** |
| `src-tauri/src/` | 185 `.rs` | 30.570 | đã gồm test nội tuyến |
| Tauri commands đã đăng ký | — | **117** | `cmdspace_commands!` trong `commands.rs` |
| Commands được frontend gọi | — | **111** | 46 file production `import { invoke }` |
| Rust `#[cfg(test)]` module | 56 | ~341 `#[test]` | 0 `#[tokio::test]` |

**Lưu ý về "LOC module"**: các con số thường thấy (`architecture` 15.6k,
`terminal` 12.9k) là **đã gồm test**. Production thực tế nhỏ hơn ~35%.

| Module (production) | LOC prod | File prod | Barrel |
|---|---|---|---|
| `architecture/` | 10.322 | 99 | có |
| `terminal/` | 8.377 | 76 | có |
| `ai/` | 6.161 | 54 | **không có** |
| `explorer/` | 6.177 | 32 | có |
| `workspaces/` | 4.622 | 37 | có |
| `source-control/` | 2.302 | 18 | có |
| `tabs/` | 2.267 | 24 | có |
| `editor/` | 2.072 | 18 | có |
| `theme/` | 1.994 | 22 | có |
| `git-history/` | 1.474 | 16 | có |
| `src/app/` | 8.134 | 74 | — (coordinator + ~90 hooks/`*Model.ts`) |

`explorer/lib/fileIcons.ts` một mình chiếm 2.681 LOC (43% module) — là icon map
sinh ra, bỏ qua khi đọc.

---

## 3. Frontend (`src/`)

### 3.1 Bốn entry point

| HTML | TS entry | Root | Ghi chú |
|---|---|---|---|
| `index.html` | `src/main.tsx` (62) | `#root` | `App`. Đợi `initLaunchDir()` trước khi paint. Có nhánh `?desktop-blur-overlay` bỏ qua React |
| `settings.html` | `src/settings/main.tsx` (43) | `#settings-root` | `SettingsApp` + `ThemeProvider` |
| `remote.html` | `src/remote/main.tsx` (14) | `#remote-root` | Entry **duy nhất** dùng `StrictMode` và **không** gate `hasTauriRuntime()` (chạy trên browser) |
| `tray.html` | `src/tray/main.tsx` (28) | `#tray-root` | `WorkspaceSwitcher` |

Tất cả khai báo trong `vite.config.ts` → `rollupOptions.input`.
`mobile/` **không có** frontend entry (chỉ Rust + Swift).

### 3.2 State — sự thật khác với tài liệu

Tài liệu nói "Zustand cho prefs, chat, env". Thực tế **chỉ có 2 store**:

1. `src/modules/settings/preferences.ts:49` — `usePreferencesStore`
   (load qua Tauri `LazyStore`, subscribe `onPreferencesChange`).
2. `src/modules/workspace/env.ts:26` — `useWorkspaceEnvStore`
   (`{kind:"local"} | {kind:"wsl",distro}`). Export hàm không-hook
   `currentWorkspaceEnv()` được dùng khắp nơi để scope workspace cho IPC.

**Không có chat store.** Tab state nằm trong
`src/modules/tabs/lib/useTabs.ts` (143 LOC, `useState` thuần). Workspace state
nằm trong `useWorkspaceController()`.

> → Câu "App.tsx owns workspace/tab/pane state" nên hiểu là *App điều phối*,
> còn owner thực sự là các hook trong `src/app/lib/` và `modules/tabs/`.

### 3.3 Cầu nối Tauri (frontend → Rust)

| File | Số commands | Vai trò |
|---|---|---|
| `src/modules/ai/lib/native.ts` (361) | **36** | IPC client lớn nhất: `workspace_*`, `fs_*`, `shell_*`, 17 `git_*` |
| `src/modules/ai/lib/agentChatRuntime.ts` | 14 | `agent_chat_*`, `db_*_agent_*` |
| `src/modules/settings/remoteAccess.ts` | 7 | `remote_access_*`, `remote_device_*` |
| `src/modules/terminal/lib/pty-bridge.ts` (84) | 5 | `pty_open/write/resize/close/register_metadata` — stream raw bytes qua `Channel<ArrayBuffer>`, không base64 |
| `src/modules/explorer/lib/fileTreeMutations.ts` | 5 | `fs_rename/delete/import_*` |
| `src/app/lib/useWorkspaceController.ts` | 4 | `db_save_pane`, `db_save_workspace`, … |

**`src/lib/tauriCommandRegistry.contract.test.ts` là best friend của bạn** — nó
quét toàn bộ `src/` và đối chiếu với `tauri::generate_handler![...]` trong
`commands.rs`, kể cả camelCase→snake_case của tham số. Chạy nó trước khi thêm
command mới.

### 3.4 Testing — pattern đặc biệt, cần biết

- **280 / 479 file test là `*.source.test.ts`**: chúng `readFileSync` chính file
  nguồn kế bên rồi `expect(source).toContain("...")`. Đây là **structural
  guard**, không phải behavior test.
- Chỉ **6 file** render thật: `gitHistoryPresentation.test.tsx`,
  `TerminalAgentPermissionPill.test.tsx`, `ImportSessionDialog.lifecycle.test.tsx`,
  `CanvasTerminalNode.render.test.tsx`, `ArchitectureCanvas.render.test.tsx`,
  `AgentEditCard.test.tsx`.
- **Không có jsdom** trong devDependencies → muốn test component thật phải thêm.
- Rust cũng có pattern tương tự: `lib.rs` có 13 `#[test]` assert trên chính text
  của `lib.rs` / `commands.rs` / `app_menu.rs`.

> Hệ quả: **test xanh ≠ hành vi đúng**. Đừng tự mãn khi thêm tính năng.

---

## 4. Backend (`src-tauri/`)

### 4.1 Đăng ký command

`lib.rs` (295 LOC) gọi `.invoke_handler(cmdspace_commands!())` ở dòng 280.
Macro `cmdspace_commands!` nằm trong `commands.rs` (138 LOC), chia 13 section
theo domain. Các facade module re-export `__cmd__*` từ con được `#[path]`-map.

| Module | Commands | | Prefix | Số lượng |
|---|---|---|---|---|
| `fs` | 21 | | `fs_*` | 19 |
| `git` | 17 | | `git_*` | 17 |
| `db` | 14 | | `db_*` | 14 |
| `pty` | 10 | | `agent_*` | 11 |
| `agent_chat` | 10 | | `shell_*` | 8 |
| `shell` | 8 | | `pty_*` | 8 |
| `remote` | 7 | | `remote_*` | 7 |
| `workspace` | 6 | | `secrets_*` | 4 |
| `window_commands` | 6 | | `wsl_*` | 3 |
| `secrets` / `speech` / `net` / `agent_usage` | 4/3/3/3 | | `speech_*` | 3 |
| `sleep` / `music` / `app_exit` | 2/2/1 | | | |

### 4.2 Module Rust

| Path | File | LOC | Chức năng |
|---|---|---|---|
| `pty/` | 18 | 3.638 | portable-pty session, agent-CLI detect, session import, shell init (6 script trong `pty/scripts/`) |
| `agent_chat/` | 36 | 4.799 | CLI agent chat (Codex/Claude/OMP), event parser, daemon, `event_sink.rs`, `runtime.rs` (941) |
| `remote/` | 27 | 5.119 | HTTP+WS remote access, device pairing, PTY-over-remote, tunnel |
| `git/` | 16 | 2.512 | wrapper git CLI: status/diff/stage/commit/log |
| `fs/` | 12 | 1.608 | tree, file IO, mutate, trash, grep/glob |
| `db/` | 6 | 1.191 | rusqlite schema + command wrapper |
| `shell/` | 4 | 859 | one-shot, persistent session, background proc (ring buffer) |
| `agent_usage_scan/` | 5 | 336 | usage scanner theo provider |

**Pattern "facade + `#[path]`"** dùng khắp nơi: `net.rs` → `net_http.rs` +
`net_security.rs`; `speech.rs` → 5 file platform; `workspace.rs` →
`workspace_{auth,launch,wsl}.rs`. Đây là cách repo giữ file nhỏ mà không đổi
module path. Nhớ đọc `mod.rs` để biết mapping.

### 4.3 Managed state (10 `.manage(` tại `lib.rs:250-266`)

`pty::PtyState` · `agent_chat::AgentChatRuntime` · `remote::RemoteAccessState` ·
`shell::ShellState` · `secrets::SecretsState` · `workspace::WorkspaceRegistry` ·
`window_commands::LaunchDir` · `window_commands::DesktopBlurState` ·
`sleep::SleepInhibitorState` · `db::DbState` · `app_exit::ExitCoordinator`

### 4.4 Persistence

- SQLite tại `dirs::data_dir()/app.tranhoangpich.cmdspace/cmdspace.db`.
- Schema **inline** trong `db/schema.rs` (299 LOC, `CREATE TABLE IF NOT EXISTS`
  + `ALTER TABLE ADD COLUMN`). **7 bảng**: `workspace_panes`,
  `workspace_setup_preferences`, `mobile_workspaces`, `workspaces`,
  `agent_chat_configs`, `agent_model_cache`, `recent_workspaces`.
- `scripts/schema/{001-init.sql,002-story-verify.sql}` có định nghĩa bảng
  `intake`/`story`/trace nhưng **không được Rust đọc** — thuộc tooling harness,
  không phải app DB.

### 4.5 Capabilities & plugins

- `capabilities/default.json` (39 dòng) + `capabilities/desktop.json` (19 dòng).
  Scope rất hẹp — **không có** core fs/shell/http permission vì mọi IO đi qua
  command Rust tự viết.
- 9 plugin: process, updater, window-state, autostart, store, os, log, opener,
  + macOS `.menu(...)`.

### 4.6 Crates ngoài

| Thư mục | Là gì |
|---|---|
| `crates/cmdspace-remote-protocol` | serde wire types (`publish = false`), là path-dep của `src-tauri` |
| `crates/cmdspace-remote-client` | client, phụ thuộc protocol |
| `mobile/` | **iOS**, Rust (`cmdspace-mobile`) + Swift (`mobile/ios/`, SwiftUI). Có `Cargo.lock` riêng, **không** thuộc workspace app |
| `services/cmdspace-relay` | **Cloudflare Worker** (Node/jest) — relay cho remote access |

---

## 5. Terminal subsystem — đọc kỹ chỗ này

- **Terminal thường** (`src/modules/terminal/`): `pty-bridge.ts` → `pty_open`;
  `rendererPool.ts` (374) giữ **12 xterm** tái sử dụng, switch pane = rebind,
  không tạo mới (đây là mẹo perf chính). Session là `Map<leafId, Session>` ở
  module scope, sống sót qua React remount.
- **OSC**: `osc-handlers.ts` xử lý OSC 7 (cwd) + OSC 133 (prompt marker). Chuẩn
  hóa `/C:/Users/foo` → `C:/Users/foo`. **Bỏ qua cwd update khi đang in-command**
  (output là untrusted).
- **macOS IME**: `macImeBridge.ts` + `normalizeMacTerminalInput` — sửa C1/NBSP
  corruption. Lịch sử bug #81/#82, đừng đụng vào nếu không đọc ADR 0003.
- **Canvas terminal** (`architecture/CanvasTerminalNode.tsx`, 631 LOC): mỗi node
  có xterm + PTY riêng, **không** dùng pool. Terminal world là HTML layer biến
  đổi bằng `translate3d(...) scale(scale)` — CSS transform không kích
  ResizeObserver nên camera zoom không bao giờ gây PTY resize.
- Windows: `SPAWN_LOCK` (Mutex) quanh `openpty + spawn_command`; mỗi ConPTY child
  gán **Job Object** với `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (trong `pty/job.rs`)
  để kill toàn bộ process subtree.

---

## 6. AI subsystem (`src/modules/ai/`, 6.161 LOC prod)

- **BYOK đa provider**: OpenAI, Anthropic, Google, Groq, xAI, Cerebras,
  OpenAI-compatible (LM Studio). Danh sách trong `config.ts` (386 LOC).
- **Key**: OS keychain qua `secrets_*`. Service `cmdspace`. **Không bao giờ**
  ghi key ra disk / store / localStorage.
- **Runtime**: `lib/agentChatRuntime.ts` (14 commands) là đường chính.
  `agent.ts` dùng `Experimental_Agent` + `stopWhen: stepCountIs(MAX_AGENT_STEPS)`.
- **Tools** (`tools/tools.ts`): `read_file`, `list_directory`, `fs_search`,
  `fs_grep` auto-run. `write_file`, `run_command`, `shell_bg_spawn`, … set
  `needsApproval: true` → chờ confirm trong UI.
- **Security**: `lib/security.ts` deny-list (`.env*`, `.ssh/`, credentials). Áp
  dụng cho **cả** đọc và ghi. `proxyFetch.ts` + `net_security.rs` chống SSRF.
- **Voice**: pipeline stream, nhiều file `voice*.ts` trong `lib/`.
- **Live context**: `App.tsx` gọi `setLive({ getCwd, getTerminalContext, … })` —
  lazy, đọc cwd + 300 dòng buffer của terminal đang active.

---

## 7. ⚠️ Rủi ro & chỗ lệch tài liệu (quan trọng nhất)

### 7.1 Post-removal state

The orchestration canvas, mailbox, worker lifecycle, memory graph, related Rust
commands, and associated planning documents were intentionally removed in
`fd4a61f81` after explicit user authorization. **Do not restore them.** The
post-removal tree has no `src-tauri/src/modules/orchestration/` directory and
no orchestration Tauri commands. The remaining architecture canvas is the
terminal/diagram canvas only.

The code removal was validated before commit with `cargo check --all-targets
--locked`, TypeScript compilation, the production Vite build, and the full
Vitest suite. This is a completed product decision, not an unresolved working-
tree divergence.

### 7.2 Các lệch khác

| Vấn đề | Chi tiết |
|---|---|
| `src/modules/git/` là dead code | 43 LOC, 2 file, **0 importer** bên ngoài. `git-history/`, `source-control/`, `ai/lib/native.ts` làm git độc lập |
| Nhầm tên dễ gặp | `workspace/` (72 LOC, store env) vs `workspaces/` (4.622 LOC, cả feature) |
| `components.json` stale | trỏ `"css": "src/App.css"` — **file không tồn tại** (CSS thật: `src/styles/globals.css`); `"hooks": "@/hooks"` — `src/hooks/` **không tồn tại** |
| `ai/`, `settings/`, `git/` thiếu barrel `index.ts` | không nhất quán với các module khác |
| Test xanh nhưng không test hành vi | 280 `*.source.test.ts` chỉ assert text |
| `tsconfig.tsbuildinfo` committed | dated 2026-07, cũ hơn source 2026-09 |
| Tên | folder `terax-ai` vs product `cmdSpace` vs crate `cmdspace_lib` |

---

## 8. Lệnh verify

```bash
# Frontend
pnpm exec tsc --noEmit
pnpm test                    # vitest + relay tests
pnpm build

# Rust
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings

# Contract drift giữa frontend invoke và Rust handler
pnpm vitest run src/lib/tauriCommandRegistry.contract.test.ts
```

---

## 9. Thứ tự đọc đề xuất (cho người mới)

1. `AGENTS.md` → `CMDSPACE.md` → `COMPREHENSIVE_PLAN.md` (map tổng)
2. `docs/architecture/design-patterns.md` (hợp đồng pattern — bắt buộc)
3. `src-tauri/src/commands.rs` (138 LOC — toàn bộ command surface)
4. `src/app/App.tsx` (1.367 LOC — coordinator)
5. `src/modules/tabs/lib/useTabs.ts` + `src/app/lib/useWorkspaceController.ts`
6. `src/modules/terminal/lib/pty-bridge.ts` (84 LOC) +
   `docs/architecture/terminal-input-pipeline.md` + `docs/adr/0002`
7. `src/modules/ai/lib/native.ts` (361 LOC — IPC chính)
8. `docs/adr/` (0001 two-process, 0002 renderer pool, 0003 macOS IME)

---

## 10. Pattern contract (tóm tắt từ `design-patterns.md`)

14 pattern active. Các invariant **không được phá**:

- **Two-process**: mọi FS/process/shell/secret/net đi qua Rust.
- **Single source of truth**: `App.tsx` điều phối; module không copy state.
- **Terminal ownership**: thường → pool; canvas → private xterm + PTY.
- **Camera isolation**: camera transform không gây PTY fit/resize.
- **Serializable snapshots**: chỉ metadata, không handle sống.
- **Security proxy**: guard path/SSRF/keychain tại native seam, cả đọc lẫn ghi.
- **Lifecycle symmetry**: open/spawn/subscribe luôn có close/dispose/detach.
- **Canonical paths**: frontend dùng forward-slash; convert ở boundary.

Khi sửa: đặt tên pattern bị ảnh hưởng, giữ invariant (hoặc đổi chính thức qua
ADR), thêm regression test tại seam, chạy verify theo layer.
