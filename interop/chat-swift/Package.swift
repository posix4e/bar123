// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "TrysteroChat",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    products: [
        .executable(name: "trystero-chat", targets: ["TrysteroChat"])
    ],
    dependencies: [
        .package(path: "../../TrysteroSwift")
    ],
    targets: [
        .executableTarget(
            name: "TrysteroChat",
            dependencies: [
                .product(name: "TrysteroSwift", package: "TrysteroSwift")
            ],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
                .enableUpcomingFeature("BareSlashRegexLiterals")
            ]
        )
    ]
)

