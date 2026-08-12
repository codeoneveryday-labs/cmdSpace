# iOS first-build research

Research date: 2026-08-12

## Findings

- Rust supports `aarch64-apple-ios` for ARM64 iOS devices and
  `aarch64-apple-ios-sim` for ARM64 iOS Simulator. The iOS targets require the
  corresponding SDK supplied by Xcode; ARM64 needs Xcode 12 or newer. Source:
  [Rust iOS platform support](https://doc.rust-lang.org/beta/rustc/platform-support/apple-ios.html).
- `rustup target add <target>` installs cross-compilation standard-library
  support, and Cargo selects that target with `--target`. Source:
  [Rustup cross-compilation](https://rust-lang.github.io/rustup/cross-compilation.html).
- Apple packages multiple platform variants using
  `xcodebuild -create-xcframework`. For static `.a` libraries outside archives,
  the command supplies each binary with `-library` and a public-header path
  with `-headers`. Device and Simulator libraries must remain separate; an
  XCFramework for iOS and Simulator needs at least those two variants. Source:
  [Apple XCFramework documentation](https://developer.apple.com/documentation/Xcode/creating-a-multi-platform-binary-framework-bundle).
- An app archive is created from Xcode's selected scheme and destination, then
  distributed from the Archives organizer. TestFlight/App Store distribution
  uploads the archive to App Store Connect. Sources:
  [Apple beta and release distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases) and
  [Apple device distribution](https://developer.apple.com/documentation/Xcode/distributing-your-app-to-registered-devices).

## Implications for this repository

The current `cmdspace-mobile` crate can compile as a static library after the
Rust iOS targets and full Xcode are installed. It cannot yet create a usable
iOS XCFramework or app because it exposes no C ABI/header and the repository
contains no Swift/Xcode host or signing configuration.
