# iOS build runbook

This runbook defines the path from the cmdSpace-owned Swift source to the first
installable iOS app. The native client is now a Swift-only codebase: a SwiftUI
application host plus a Swift Package core. There is no Rust static library or
XCFramework step in the current iOS build.

## Status

`mobile/ios/` contains a cmdSpace-authored SwiftUI application and a Swift
Package core:

- `CmdSpaceMobileApp/` — SwiftUI app host (`CmdSpaceMobileApp.swift`, `RootView.swift`,
  `RemoteStore.swift`, pairing and QR scanning views).
- `CmdSpaceMobileCore/` — Swift Package with the typed pairing/wire payloads,
  device identity, terminal display normalization, and terminal input detection.
- `project.yml` — `xcodegen` specification that generates
  `CmdSpaceMobile.xcodeproj` and wires the app target to the `CmdSpaceMobileCore`
  framework target.

The Xcode project is generated on demand and must not be committed. There is no
Apple team identifier, provisioning profile, archive, or IPA in source control.

## Scope and ownership

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Remote wire contract | `crates/cmdspace-remote-protocol` | Versioned desktop messages and stream decoding. |
| Swift core | `mobile/ios/CmdSpaceMobileCore` | Typed pairing payloads, device identity, wire envelopes, terminal display/input normalization. |
| iOS UI | `mobile/ios/CmdSpaceMobileApp` | SwiftUI screens, one WebSocket in `RemoteStore`, Keychain-backed identity, camera QR. |
| Desktop authority | `src-tauri` | Pairing grants, device registry, mobile workspaces, PTY/session ownership. |

The iOS app renders `RemoteStore` state and forwards its actions. It must not
own PTYs, duplicate protocol sequencing, or depend on `src-tauri`.

## Prerequisites

1. Install the current full Xcode release from Apple, launch it once, and accept
   its licence. Command Line Tools alone are insufficient for Simulator, device
   signing, archive, and export commands.
2. Install `xcodegen`:

   ```bash
   brew install xcodegen
   ```

3. Before a physical-device archive, configure the approved cmdSpace Apple
   Developer team and a unique bundle identifier. Do not add an Apple team
   identifier to source control.

Check the local toolchain:

```bash
xcode-select -p
xcodebuild -version
xcodegen --version
```

The active developer directory must be the full Xcode installation, rather than
`/Library/Developer/CommandLineTools`.

## Run the Swift core checks

The core package is buildable and testable without a generated Xcode project:

```bash
swift build --package-path mobile/ios/CmdSpaceMobileCore
swift test --package-path mobile/ios/CmdSpaceMobileCore
swift run --package-path mobile/ios/CmdSpaceMobileCore CmdSpaceMobileCoreCheck
```

## Generate and build the app

Generate the Xcode project from `project.yml`, then build for a Simulator:

```bash
xcodegen generate --spec mobile/ios/project.yml --project mobile/ios
xcodebuild -project mobile/ios/CmdSpaceMobile.xcodeproj -scheme CmdSpaceMobile \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build
```

To build against a specific installed Simulator, list devices and substitute
the UUID:

```bash
xcrun simctl list devices available
xcodebuild \
  -project mobile/ios/CmdSpaceMobile.xcodeproj \
  -scheme CmdSpaceMobile \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' \
  build
```

## Physical-device archive

For the first physical-device archive, generate the project and archive against
the generic iOS destination:

```bash
xcodegen generate --spec mobile/ios/project.yml --project mobile/ios
xcodebuild \
  -project mobile/ios/CmdSpaceMobile.xcodeproj \
  -scheme CmdSpaceMobile \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/mobile/build/CmdSpaceMobile.xcarchive" \
  archive
```

`mobile/build/` is a local build output. Do not commit an archive, IPA,
generated Xcode project, provisioning profile, or signing identity.

Only add an `ExportOptions.plist` and run `xcodebuild -exportArchive` after the
distribution method and signing ownership are approved. Open the archive in
Xcode Organizer for the first TestFlight upload to verify the selected team and
signing identity visually.

## Build acceptance checklist

- [ ] Swift core build, tests, and the `CmdSpaceMobileCoreCheck` executable pass.
- [ ] The generated Xcode project builds for the iPhone 16 Simulator.
- [ ] A Simulator pairs to a development desktop and renders terminal output.
- [ ] A physical device repeats the pairing and terminal-output test.
- [ ] A Release archive succeeds with the approved signing team.
- [ ] No pairing token, provisioning profile, certificate, `.xcarchive`, IPA,
  generated Xcode project, or signing identity is committed.

## Manual native v3 smoke test

Use this after the Simulator host builds. It validates the same native-device
endpoint that the desktop Settings pairing QR creates; do not use the browser
password QR for this test.

1. In desktop **Settings → Network**, enable Remote Access and choose **Pair
   device** under Native iPhone / iPad.
2. In cmdSpace Remote, scan the resulting QR. The home screen should change from
   Pair Device to Connecting, then show the saved desktop as connected.
3. Open the workspace drawer, choose a remote terminal, enter
   `printf 'cmdspace-ios-smoke-ok\n'`, and submit. The terminal must show that
   exact output.
4. Force-close the iOS app, relaunch it, and use Reconnect. It must connect
   without scanning the QR a second time.
5. Back on desktop, revoke the iPhone. A subsequent reconnect must fail; pair a
   new QR and confirm the new connection works.

The desktop automated tests mirror steps 2 and 4 at the WebSocket protocol
boundary. This manual run proves Apple Keychain, camera, UI, and device
transport together.

## References

- [Apple: Distributing your app to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- [Rust platform support: iOS targets](https://doc.rust-lang.org/rustc/platform-support.html)
