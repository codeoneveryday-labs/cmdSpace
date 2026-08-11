# Changelog

All notable changes to cmdSpace are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[0.7.85]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.84...v0.7.85
[0.7.80]: https://github.com/codeoneveryday-labs/cmdSpace/compare/v0.7.79...v0.7.80
