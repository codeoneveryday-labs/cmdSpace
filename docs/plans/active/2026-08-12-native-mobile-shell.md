# Native Mobile Shell

**Outcome:** Establish a standalone GPUI workspace and render the first Terax Remote shell without coupling it to desktop Tauri.

**Approach:** Pin Zedra's mobile GPUI fork as a git submodule and add the small `terax-mobile` crate. The shared Rust remote client remains the application state source; this shell only renders its current connection state.

**Proof:** `cargo check --manifest-path mobile/Cargo.toml -p terax-mobile`, focused client/protocol tests, and the existing desktop build.

## Progress

- [x] Pin the Zedra GPUI fork as a submodule.
- [x] Add the standalone GPUI shell.
- [x] Validate its Cargo manifest and verify existing protocol/client/desktop checks.
- [ ] Complete the platform shell compile after installing full Xcode and Android NDK toolchains.

## Validation note

The native shell's source and Cargo dependency graph resolve successfully.
The macOS GPUI compile reaches the Metal shader build, then stops because this
machine selects `/Library/Developer/CommandLineTools` and has no `metal`
utility. Full Xcode is required to complete that platform build. This does not
affect the shared client crate or the Tauri desktop build.

Android compilation reaches its native dependencies and then stops because no
Android NDK compiler (`aarch64-linux-android-clang`) is installed. The Rust
Android target is present; the missing part is the external NDK toolchain.
