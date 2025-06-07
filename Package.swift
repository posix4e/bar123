// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "bar123",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "bar123",
            targets: ["bar123"])
    ],
    dependencies: [
        // We'll use a Swift wrapper for libtorrent instead of building from source
        // This is a placeholder - we'll need to find or create a proper Swift package
        // .package(url: "https://github.com/example/SwiftTorrent.git", from: "1.0.0")
    ],
    targets: [
        .target(
            name: "bar123",
            dependencies: [],
            path: "bar123"
        ),
        .target(
            name: "bar123Extension",
            dependencies: [],
            path: "bar123 Extension"
        ),
        .testTarget(
            name: "bar123Tests",
            dependencies: ["bar123"],
            path: "bar123Tests"
        )
    ]
)