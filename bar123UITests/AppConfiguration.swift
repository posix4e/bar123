import Foundation

// Centralized app configuration (UITests copy)
struct AppConfiguration {
    static let teamID = "6746350013"
    static let bundleIDPrefix = "com.apple-\(teamID)"
    static let appGroupIdentifier = "group.\(bundleIDPrefix).bar123"
    static let extensionBundleID = "\(bundleIDPrefix).bar123.Extension"
    static let nativeMessageAppID = "\(bundleIDPrefix).bar123"
    
    // Notification names
    static let historyUpdatedNotification = "\(bundleIDPrefix).bar123.historyUpdated"
    static let newHistoryItemsNotification = "\(bundleIDPrefix).bar123.newHistoryItems"
    
    // Logging
    static let logSubsystem = "\(bundleIDPrefix).bar123"
}