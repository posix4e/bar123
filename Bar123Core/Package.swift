// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Bar123Core",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "Bar123Core",
            targets: ["Bar123Core"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "Bar123Core",
            dependencies: []
        ),
        .testTarget(
            name: "Bar123CoreTests",
            dependencies: ["Bar123Core"]
        ),
    ]
)