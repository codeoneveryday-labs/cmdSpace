# Changelog

All notable changes to cmdSpace are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
[0.7.87]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.86...v0.7.87
[0.7.88]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.87...v0.7.88
[0.7.85]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.84...v0.7.85
[0.7.80]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.79...v0.7.80
