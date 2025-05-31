//
//  SafariWebExtensionHandler.swift
//  bar123 Extension
//
//  Created by Alex Newman on 5/22/25.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        var responseData: [String: Any] = ["echo": message as Any]
        
        // Handle App Group storage messages
        if let messageDict = message as? [String: Any] {
            os_log(.default, "Message parsed as dictionary: %@", String(describing: messageDict))
            
            if let type = messageDict["type"] as? String {
                os_log(.default, "Message type: %@", type)
                
                switch type {
                case "saveSharedSecret":
                    if let secret = messageDict["secret"] as? String {
                        os_log(.default, "Attempting to save secret of length: %d", secret.count)
                        let success = saveSharedSecret(secret)
                        responseData = [
                            "type": "saveSharedSecretResponse",
                            "success": success
                        ]
                        os_log(.default, "Saved shared secret to App Group: %@", success ? "success" : "failed")
                    } else {
                        os_log(.error, "No secret found in saveSharedSecret message")
                    }
                case "getSharedSecret":
                    let secret = getSharedSecret()
                    responseData = [
                        "type": "getSharedSecretResponse",
                        "secret": secret
                    ]
                    os_log(.default, "Retrieved shared secret from App Group: %@", secret.isEmpty ? "empty" : "found")
                case "extensionToApp":
                    // Handle messages from extension to native app
                    if let appMessage = messageDict["message"] as? [String: Any] {
                        os_log(.default, "Forwarding message to native app: %@", String(describing: appMessage))
                        handleExtensionToAppMessage(appMessage)
                        responseData = [
                            "type": "extensionToAppResponse",
                            "success": true
                        ]
                    }
                default:
                    os_log(.default, "Unknown message type: %@", type)
                    responseData = ["echo": message as Any]
                }
            } else {
                os_log(.default, "No type field found in message")
            }
        } else {
            os_log(.default, "Message could not be parsed as dictionary")
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseData ]
        } else {
            response.userInfo = [ "message": responseData ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
    
    private func saveSharedSecret(_ secret: String) -> Bool {
        os_log(.default, "saveSharedSecret called with secret length: %d", secret.count)
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return false
        }
        
        os_log(.default, "Successfully accessed shared UserDefaults")
        
        if secret.isEmpty {
            os_log(.default, "Removing room secret from shared storage")
            sharedDefaults.removeObject(forKey: "roomSecret")
        } else {
            os_log(.default, "Setting room secret in shared storage")
            sharedDefaults.set(secret, forKey: "roomSecret")
        }
        
        let syncResult = sharedDefaults.synchronize()
        os_log(.default, "UserDefaults synchronize result: %@", syncResult ? "success" : "failed")
        
        // Verify the save worked
        let retrievedSecret = sharedDefaults.string(forKey: "roomSecret") ?? ""
        os_log(.default, "Verification: retrieved secret length: %d", retrievedSecret.count)
        
        return syncResult
    }
    
    private func getSharedSecret() -> String {
        os_log(.default, "getSharedSecret called")
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return ""
        }
        
        let secret = sharedDefaults.string(forKey: "roomSecret") ?? ""
        os_log(.default, "Retrieved secret from shared storage, length: %d", secret.count)
        
        return secret
    }
    
    private func handleExtensionToAppMessage(_ message: [String: Any]) {
        guard let messageType = message["type"] as? String else {
            os_log(.error, "No type in extension-to-app message")
            return
        }
        
        os_log(.default, "Handling extension-to-app message type: %@", messageType)
        
        switch messageType {
        case "newHistoryEntry":
            if let entry = message["entry"] as? [String: Any] {
                os_log(.default, "Received new history entry from extension")
                // Store in shared UserDefaults for the native app to pick up
                storeHistoryEntryForApp(entry)
            }
        case "historyEntryUpdated":
            if let entry = message["entry"] as? [String: Any] {
                os_log(.default, "Received updated history entry from extension")
                storeHistoryEntryForApp(entry)
            }
        case "fullHistorySync":
            if let entries = message["entries"] as? [[String: Any]] {
                os_log(.default, "Received full history sync with %d entries", entries.count)
                storeFullHistoryForApp(entries)
            }
        case "historyCleared":
            os_log(.default, "History cleared in extension")
            clearHistoryForApp()
        default:
            os_log(.default, "Unknown extension-to-app message type: %@", messageType)
        }
    }
    
    private func storeHistoryEntryForApp(_ entry: [String: Any]) {
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for history storage")
            return
        }
        
        // Get existing entries
        var existingEntries = sharedDefaults.array(forKey: "pendingHistoryEntries") as? [[String: Any]] ?? []
        
        // Add new entry
        existingEntries.append(entry)
        
        // Keep only last 100 entries
        if existingEntries.count > 100 {
            existingEntries = Array(existingEntries.suffix(100))
        }
        
        sharedDefaults.set(existingEntries, forKey: "pendingHistoryEntries")
        sharedDefaults.synchronize()
        
        os_log(.default, "Stored history entry for app pickup. Total pending: %d", existingEntries.count)
    }
    
    private func storeFullHistoryForApp(_ entries: [[String: Any]]) {
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for full history storage")
            return
        }
        
        sharedDefaults.set(entries, forKey: "fullHistorySync")
        sharedDefaults.set(Date().timeIntervalSince1970, forKey: "fullHistorySyncTimestamp")
        sharedDefaults.synchronize()
        
        os_log(.default, "Stored full history sync for app pickup. Entry count: %d", entries.count)
    }
    
    private func clearHistoryForApp() {
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for history clearing")
            return
        }
        
        sharedDefaults.removeObject(forKey: "pendingHistoryEntries")
        sharedDefaults.removeObject(forKey: "fullHistorySync")
        sharedDefaults.set(Date().timeIntervalSince1970, forKey: "historyClearedTimestamp")
        sharedDefaults.synchronize()
        
        os_log(.default, "Cleared history for app")
    }

}
