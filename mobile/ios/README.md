# cmdSpace for iOS

The iOS app is cmdSpace-owned SwiftUI source. Its visual language is terminal
first: near-black canvas, compact mono metadata, a thin workspace drawer, and
the existing cmdSpace application icon. It does not reuse Zedra source,
logo, or artwork.

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

Do not add an Apple team ID, provisioning profile, archive, IPA, or generated
Xcode artifacts to source control.
