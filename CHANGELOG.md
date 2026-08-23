# Changelog

All notable changes to cmdSpace are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.7.98] - 2026-08-23

### Added

- Added a workspace terminal creation menu that reuses the header agent picker
  for normal terminals and configured CLI agents.
- Added a visible capacity notice when a workspace has reached its terminal
  limit.
- Added Cmd/Ctrl+Shift+W to close the active terminal pane.

### Changed

- New terminal choices now create panes directly in the active workspace rather
  than opening a new tab.

## [0.7.97] - 2026-08-23

### Added

- Expanded the opt-in CLI-agent catalog with marketplace entries and copied
  agent artwork, while keeping the six existing agents as the only defaults.
- Added terminal line shortcuts, fast input clearing, workspace terminal drag
  swapping, and the expanded remote-access workspace UI.
- Added native macOS About-panel branding with a rounded cmdSpace icon.

### Changed

- Improved CLI-agent detection, session resume fallback, and cross-platform
  remote hostname handling.

### Known limitations

- Some marketplace agents require their own CLI installation and credentials;
  adding an entry does not install or authenticate the agent automatically.

## [0.7.96] - 2026-08-18

### Fixed

- Windows clippy failure in CI: `#[allow(unused_mut)]` now sits on the
  `let mut entries` binding in `check_agent_clis`, so the Windows check job
  passes again.

## [0.7.95] - 2026-08-18

### Fixed

- Restored the Windows build broken in v0.7.94: `is_executable_file` is now
  compiled on every platform again.

## [0.7.94] - 2026-08-18

### Fixed

- CLI agents (Claude Code, Codex, Gemini CLI, and others) installed via
  Homebrew or user bin dirs are now detected as installed in Settings > CLI,
  instead of being reported "Not installed" because the app process inherits a
  minimal PATH on macOS.
- The voice input agent now uses the transparent logo variant in light mode
  and the inverted logo in dark mode, removing a stray black square.

## [0.7.91] - 2026-08-18

### Added

- Stable cross-network remote terminal access via a Cloudflare Workers relay
  (`services/cmdspace-relay`): the desktop connects outbound and the iOS device
  reaches it through the same relay, with per-connection multiplexing.
- iOS relay pairing, device-scoped mobile workspaces, terminal input modes, and
  display-text normalization in the native app.
- A compact Remote Access Hub in settings for tunnel, relay, and device status.
- A 1024px light-mode logo asset.

### Changed

- Hardened the remote tunnel reconnect/backoff and added device-scoped mobile
  workspace rows to the desktop SQLite store.
- Polished the workspace sidebar: the terminals section now renders full-width
  borders, and explorer tree rows and search were trimmed.
- Removed stale repository artifacts (`paseo.json`, `.cate/`).

### Known limitations

- The iOS relay path still needs a manual physical-device pass and Apple
  signing/archive setup before TestFlight upload; terminal rendering on iOS is
  output-plus-input, not a full ANSI cell-grid emulator.

## [0.7.90] - 2026-08-18

### Added

- Compact remote access hub in the settings window.
- Terminal collaboration capabilities: drag terminal rows to swap panes and
  agent-logos preserved in the drag preview.

### Changed

- Restored the compact response loader for agent activity.

## [0.7.89] - 2026-08-12

### Added

- Activated Deepgram cloud transcription when a configured provider is selected.

### Changed

- Preserved mobile terminal IME composition and sent remote shortcut keys as
  terminal control bytes instead of text literals.
- Anchored the native iOS pairing Settings control to the pairing scene.

### Known limitations

- Android Telex composition and the iOS pairing flow still need a manual
  physical-device pass before TestFlight upload.

## [0.7.88] - 2026-08-12

### Added

- VS Code-style SVG icons in the file explorer for common code, configuration,
  and document file types.
- A provider-specific Space speech-to-text readiness check and bounded
  workspace terminology sent with cloud transcription requests.

### Changed

- Polished the native iOS pairing screen: the Settings control stays in the
  top-right corner, the GitHub destination uses its official vector mark, and
  obsolete pairing copy is removed.

### Known limitations

- The iOS source is ready for local device testing, but a physical-device
  pairing pass and Apple signing/archive setup remain required before TestFlight
  upload.
- Live cloud STT readiness and Vietnamese-English transcription still require a
  user-configured provider key and manual device test.

## [0.7.87] - 2026-08-12

### Added

- Native cmdSpace iOS remote foundation with QR pairing, a secure device
  identity, Keychain-backed credentials, reconnect support, and terminal intent
  handling.
- Desktop-side native-device pairing protocol with one-time QR payloads,
  signed reconnect challenges, capability scopes, and device revocation.

### Changed

- Simplified the desktop bundle by removing stale generated Vite artifacts,
  unreachable UI helpers, and unused direct npm dependencies.

### Known limitations

- The iOS source is ready for local device testing, but a physical-device pairing
  pass and Apple signing/archive setup remain required before TestFlight upload.

## [0.7.85] - 2026-08-11

### Added

- Cloud speech-provider catalog with provider setup, brand artwork, and native
  speech fallback in Voice settings.
- CLI-style speech-provider management: configured providers, enable state,
  searchable catalog, and model selection limited to configured providers.
- Workspace selection/persistence boundaries and canvas geometry helpers.

### Changed

- Centralized cmdSpace product identity and CLI launch policies.
- Simplified the voice-first surface while preserving native speech fallback.

### Known limitations

- Several cloud STT providers are staged in settings and intentionally fall
  back to native speech until their provider-specific realtime adapter ships.

## [0.7.80] - 2026-08-09

### Added

- Live Browser nodes on Architecture Canvas, with URL navigation and persisted
  canvas layout.
- Live Editor nodes on Architecture Canvas, with file-path selection, editing,
  and persisted canvas layout.

[0.7.89]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.88...v0.7.89
[0.7.97]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.96...v0.7.97
[0.7.98]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.97...v0.7.98
[0.7.87]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.86...v0.7.87
[0.7.88]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.87...v0.7.88
[0.7.85]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.84...v0.7.85
[0.7.80]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.79...v0.7.80
