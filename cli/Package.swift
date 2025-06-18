// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "bar123-cli",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.2.0"),
        .package(url: "https://github.com/swift-server/async-http-client", from: "1.19.0"),
        .package(path: "../Bar123Core")
    ],
    targets: [
        .executableTarget(
            name: "bar123-cli",
            dependencies: [
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
                .product(name: "AsyncHTTPClient", package: "async-http-client"),
                .product(name: "Bar123Core", package: "Bar123Core")
            ],
            path: "Sources"
        )
    ]
)