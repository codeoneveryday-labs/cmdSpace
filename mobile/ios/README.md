# cmdSpace for iOS

The iOS app is cmdSpace-owned SwiftUI source. Its visual language is terminal
first: near-black canvas, compact mono metadata, a thin workspace drawer, and
the existing cmdSpace application icon. It does not reuse Zedra source, logo, or
artwork.

## Structure

- `CmdSpaceMobileApp/` — SwiftUI application host. `RemoteStore.swift` owns the
  single WebSocket and published connection/workspace/session state;
  `RootView.swift` contains the Home, workspace, terminal, file, and import
  screens.
- `CmdSpaceMobileCore/` — Swift Package with the typed pairing payload, device
  identity, wire envelopes, terminal display normalization, and terminal input
  detection.
- `project.yml` — `xcodegen` specification. Generates `CmdSpaceMobile.xcodeproj`
  and links the app target to the `CmdSpaceMobileCore` framework.

## Pairing protocol

1. Desktop Settings produces a `cmdspace://device-pair` QR with a short-lived,
   single-use grant.
2. The app parses only HTTPS public endpoints and converts the endpoint to
   `wss://…/api/remote/device/ws`.
3. A Curve25519 signing key is created once and held in Keychain using
   `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
4. The initial socket signs the QR grant; reconnects sign the new host
   challenge. The QR grant is never saved.

The app uses Apple's `VisionKit` for QR scanning; it falls back to a paste
field when camera scanning is unavailable (including some Simulator setups).

## Mobile workspaces

A paired device owns an independent set of mobile workspaces. Each mobile
workspace is persisted by the desktop host and scoped to that device, storing
only user-facing metadata and an authorized working directory. It is never
created from, hydrated by, or replayed as a desktop workspace pane.

Mobile terminals are child runtimes of a mobile workspace. Their PTYs are
ephemeral: a desktop host restart stops them rather than replaying commands.
Importing an agent session starts a new mobile PTY with a resume command; it
does not attach an already-running desktop agent process.

## Local source checks

```bash
swift build --package-path mobile/ios/CmdSpaceMobileCore
swift test --package-path mobile/ios/CmdSpaceMobileCore
swift run --package-path mobile/ios/CmdSpaceMobileCore CmdSpaceMobileCoreCheck
```

Generate and build the app with full Xcode:

```bash
brew install xcodegen
xcodegen generate --spec mobile/ios/project.yml --project mobile/ios
xcodebuild -project mobile/ios/CmdSpaceMobile.xcodeproj -scheme CmdSpaceMobile \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build
```

Do not add an Apple team ID, provisioning profile, archive, IPA, generated
Xcode project, or signing identity to source control.
