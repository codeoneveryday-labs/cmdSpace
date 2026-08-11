# Native Mobile Foundation Design

## Decision

Build a Zedra-inspired native mobile remote client in stages. The first stage
extracts the existing remote wire contract into framework-free Rust so desktop
and future iOS/Android clients share the same authoritative protocol.

## Seams

`terax-remote-protocol` owns protocol versioning, wire messages, session
metadata, envelopes, and UTF-8 stream decoding. It depends only on `serde`.
The Tauri remote server remains the host adapter: it owns PTYs, authentication,
WebSocket transport, and storage. Mobile will be a second adapter later.

## Constraints

Do not create a root Cargo workspace yet. Making `src-tauri` a workspace member
would relocate its lockfile and require release-process migration. Do not add
GPUI or native iOS/Android shells until the framework pin and vendor strategy
are introduced in a dedicated platform phase.

## Validation

The shared crate has wire-contract tests. Existing Tauri tests continue to
import the Tauri adapter, proving the extraction did not change desktop
behavior. Host checks compile both the shared crate and `src-tauri`.
