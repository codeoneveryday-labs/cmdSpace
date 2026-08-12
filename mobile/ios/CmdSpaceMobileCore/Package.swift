// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "CmdSpaceMobileCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CmdSpaceMobileCore", targets: ["CmdSpaceMobileCore"]),
        .executable(name: "CmdSpaceMobileCoreCheck", targets: ["CmdSpaceMobileCoreCheck"]),
    ],
    targets: [
        .target(name: "CmdSpaceMobileCore"),
        .executableTarget(name: "CmdSpaceMobileCoreCheck", dependencies: ["CmdSpaceMobileCore"]),
        .testTarget(name: "CmdSpaceMobileCoreTests", dependencies: ["CmdSpaceMobileCore"]),
    ]
)
