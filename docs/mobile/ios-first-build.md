# First iOS build runbook

This runbook defines the path from the current cmdSpace-owned Rust mobile core to
the first installable iOS app. It deliberately separates the artifact that can
be built now from the app host that still needs to be added.

## Status

As of this document, `mobile/cmdspace-mobile` is an independent Rust workspace
with `staticlib`, `cdylib`, and `rlib` outputs. It has no iOS Xcode project,
Swift entry point, exported C ABI, generated header, or signing configuration.

Therefore, the commands in **Build the Rust artifact** validate an iOS library,
not an installable `.app`. The **Create the first app host** checklist must be
completed and committed before an archive or TestFlight build is claimed.

## Scope and ownership

| Layer | Owner | Current responsibility |
| --- | --- | --- |
| Remote protocol | `crates/cmdspace-remote-protocol` | Versioned messages and stream decoding |
| Client lifecycle | `crates/cmdspace-remote-client` | Pairing, session and terminal intent sequencing |
| Mobile state | `mobile/cmdspace-mobile` | Pairing screen, session metadata and terminal output state |
| iOS adapter (to add) | `mobile/ios` | Swift UI, WebSocket, secure token storage and Rust bridge |

The iOS adapter must render `CmdSpaceMobileApp` state and forward its actions. It
must not own PTYs, duplicate protocol sequencing, or depend on `src-tauri`.

## Prerequisites

1. Install the current full Xcode release from Apple, launch it once, and
   accept its licence. Command Line Tools alone are insufficient for Simulator,
   device signing, archive, and export commands.
2. Install Rust through `rustup`.
3. Before a physical-device archive, configure the approved cmdSpace Apple
   Developer team and a unique bundle identifier in the future Xcode project.
   Do not add an Apple team identifier to source control.

Check the local toolchain:

```bash
xcode-select -p
xcodebuild -version
rustup --version
rustup target list --installed
```

The active developer directory must be the full Xcode installation, rather
than `/Library/Developer/CommandLineTools`.

## Build the Rust artifact

Run the existing behavioral checks first:

```bash
cargo test --manifest-path mobile/Cargo.toml -p cmdspace-mobile
cargo clippy --manifest-path mobile/Cargo.toml -p cmdspace-mobile --all-targets -- -D warnings
```

Install the device and Apple-silicon Simulator Rust targets once:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
```

Build the static library for each architecture:

```bash
cargo build --manifest-path mobile/Cargo.toml -p cmdspace-mobile --lib --target aarch64-apple-ios --release
cargo build --manifest-path mobile/Cargo.toml -p cmdspace-mobile --lib --target aarch64-apple-ios-sim --release
```

The commands above are the first executable iOS artifact milestone. They do not
yet create a Swift-callable framework: Apple requires a header when packaging a
static library outside an Xcode archive, and the current crate intentionally
has no C ABI or header.

After the Rust bridge has added `mobile/cmdspace-mobile/include/cmdspace_mobile.h`,
package the two library variants for Xcode:

```bash
xcodebuild -create-xcframework \
  -library mobile/target/aarch64-apple-ios/release/libcmdspace_mobile.a \
  -headers mobile/cmdspace-mobile/include \
  -library mobile/target/aarch64-apple-ios-sim/release/libcmdspace_mobile.a \
  -headers mobile/cmdspace-mobile/include \
  -output mobile/build/CmdSpaceMobile.xcframework
```

`mobile/build/` is a local build output. Do not commit the generated
XCFramework or an archive.

The Apple-silicon Simulator library is enough for the first build on an Apple
silicon Mac. Before distributing an XCFramework to Intel development Macs, add
the `x86_64-apple-ios` Simulator target and include its slice in the Simulator
library; never combine device and Simulator slices into one library.

## Create the first app host

Before the following Xcode commands are usable, add and review these
cmdSpace-authored files:

1. `mobile/ios/CmdSpaceMobile.xcodeproj` with an iOS SwiftUI application target.
2. A narrow Rust C ABI and public header (or generated equivalent) for the
   operations the Swift adapter needs. The current Rust crate has no exported
   Swift-callable API, so an XCFramework alone cannot prove integration.
3. A Swift bridge that owns one WebSocket, hands decoded `ServerMessage` values
   to the Rust state core, and sends the resulting protocol envelopes.
4. Keychain-backed token storage. The current Rust state intentionally does not
   persist pairing tokens.
5. Bundle identifier, deployment target, app icon, and signing settings.

Keep clear-text pairing tokens out of logs, source control, and crash reports.
The current pairing core accepts `ws://` and `wss://`; production transport
policy requires a separate security decision before distribution.

## Build and run the host

After the project exists, choose a locally installed Simulator device:

```bash
xcrun simctl list devices available
```

Substitute its UUID in the build command:

```bash
xcodebuild \
  -project mobile/ios/CmdSpaceMobile.xcodeproj \
  -scheme CmdSpaceMobile \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' \
  build
```

For the first physical-device archive:

```bash
xcodebuild \
  -project mobile/ios/CmdSpaceMobile.xcodeproj \
  -scheme CmdSpaceMobile \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/mobile/build/CmdSpaceMobile.xcarchive" \
  archive
```

Only add an `ExportOptions.plist` and run `xcodebuild -exportArchive` after the
distribution method and signing ownership are approved. The archive should be
opened in Xcode Organizer for the first TestFlight upload, where the selected
team and signing identity can be verified visually.

## First-build acceptance checklist

- [ ] `cmdspace-mobile` tests and Clippy pass.
- [ ] Device and Simulator static libraries compile.
- [ ] The XCFramework contains both platforms.
- [ ] A Swift host calls the explicit Rust bridge and displays Pair device,
  Connecting, and Remote state.
- [ ] A Simulator connects to a development desktop and renders terminal output.
- [ ] A physical device repeats the pairing and terminal-output test.
- [ ] A Release archive succeeds with the approved signing team.
- [ ] No pairing token, provisioning profile, certificate, `.xcarchive`, IPA, or
  XCFramework is committed.

## Manual native v3 smoke test

Use this after the Simulator host builds. It validates the same native-device
endpoint that the desktop Settings pairing QR creates; do not use the browser
password QR for this test.

1. In desktop **Settings → Network**, enable Remote Access and choose **Pair
   device** under Native iPhone / iPad.
2. In cmdSpace Remote, scan the resulting QR. The home screen should change from
   Pair Device to Connecting, then show the saved desktop as connected.
3. Open the workspace drawer, choose a remote terminal, enter
   `printf 'cmdspace-ios-smoke-ok\\n'`, and submit. The terminal must show that
   exact output.
4. Force-close the iOS app, relaunch it, and use Reconnect. It must connect
   without scanning the QR a second time.
5. Back on desktop, revoke the iPhone. A subsequent reconnect must fail; pair a
   new QR and confirm the new connection works.

The desktop automated tests mirror steps 2 and 4 at the WebSocket protocol
boundary. This manual run proves Apple Keychain, camera, UI, and device
transport together.

## References

- [Rust platform support: iOS targets](https://doc.rust-lang.org/rustc/platform-support.html)
- [Rustup cross-compilation](https://rust-lang.github.io/rustup/cross-compilation.html)
- [Apple: Creating a multi-platform binary framework bundle](https://developer.apple.com/documentation/xcode/creating-a-multi-platform-binary-framework-bundle)
- [Apple: Distributing your app to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
