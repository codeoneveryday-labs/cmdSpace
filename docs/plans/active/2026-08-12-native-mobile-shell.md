# Native Mobile Application Foundation

**Outcome:** Establish a standalone native application workspace without coupling it to desktop Tauri or unapproved third-party UI source.

**Approach:** Keep `cmdspace-mobile` as a small cmdSpace-authored app-state crate. The shared Rust remote client remains the application state source; UI, platform transport, and secure storage remain isolated until an approved dependency is chosen.

**Proof:** `cargo test --manifest-path mobile/Cargo.toml -p cmdspace-mobile`, focused client/protocol tests, and the existing desktop build.

## Progress

- [x] Add the standalone cmdSpace app-state foundation.
- [x] Remove external UI source and its associated dependency lock data.
- [ ] Select an independently reviewed UI/runtime dependency before building platform adapters.

## Decision

An external UI/runtime dependency is not part of the current repository state.
Its license and distribution terms must be approved before adding it.
