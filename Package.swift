// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "bar123",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "bar123",
            targets: ["bar123"]),
    ],
    dependencies: [
        // WebRTC framework for iOS
        .package(url: "https://github.com/stasel/WebRTC.git", .upToNextMajor(from: "120.0.0"))
    ],
    targets: [
        .target(
            name: "bar123",
            dependencies: [
                .product(name: "WebRTC", package: "WebRTC")
            ]),
        .testTarget(
            name: "bar123Tests",
            dependencies: ["bar123"]),
    ]
)