# Native Mobile Client Core Design

## Decision

The second mobile phase provides the platform-neutral client state layer that a
Zedra-style UI will render. It owns remote connection state and session
selection, but it owns neither a network socket nor a terminal emulator.

## Boundaries

`terax-remote-client` depends only on `terax-remote-protocol`. It turns user
intent and received `ServerMessage` values into explicit `RemoteClientAction`
values. A future GPUI platform adapter is responsible for executing `Send`
actions on its WebSocket, persisting its token in a device secure store, and
rendering terminal data.

The client tracks protocol handshake state, active-session attachment,
per-session output sequence numbers, the current session list, and a bounded
queue of commands issued while authentication is pending. A changed server
runtime ID clears sequence state before the next attachment.

## Non-goals

This phase does not add a GPUI vendor, Android Gradle project, iOS Xcode
project, a WebSocket dependency, device authentication storage, or terminal
rendering. Those are platform adapters; mixing any of them into the state layer
would make protocol lifecycle tests require a mobile target.

## Validation

Unit tests cover handshake/authentication, active-session switching, queued
commands, output de-duplication, runtime restart recovery, and unauthenticated
errors. The existing desktop protocol and web client contract tests remain
unchanged.
