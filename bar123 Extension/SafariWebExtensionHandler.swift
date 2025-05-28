//
//  SafariWebExtensionHandler.swift
//  bar123 Extension
//
//  Created by Alex Newman on 5/22/25.
//

import SafariServices
import os.log
import UIKit

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
                case "getBatteryStatus":
                    let batteryInfo = getBatteryStatus()
                    responseData = [
                        "type": "getBatteryStatusResponse",
                        "isCharging": batteryInfo.isCharging,
                        "batteryLevel": batteryInfo.level,
                        "batteryState": batteryInfo.state
                    ]
                    os_log(.default, "Battery status: charging=%@, level=%.2f, state=%@", 
                           batteryInfo.isCharging ? "yes" : "no", batteryInfo.level, batteryInfo.state)
                case "updateLocalHistoryData":
                    if let historyCount = messageDict["historyCount"] as? Int,
                       let deviceId = messageDict["deviceId"] as? String {
                        updateLocalHistoryData(historyCount: historyCount, deviceId: deviceId, lastSyncTime: messageDict["lastSyncTime"] as? TimeInterval)
                        responseData = [
                            "type": "updateLocalHistoryDataResponse",
                            "success": true
                        ]
                    }
                case "updateHistory":
                    if let historyData = messageDict["history"] as? [[String: Any]],
                       let deviceId = messageDict["deviceId"] as? String {
                        let success = updateHistoryFromExtension(historyData: historyData, deviceId: deviceId)
                        responseData = [
                            "type": "updateHistoryResponse",
                            "success": success
                        ]
                    }
                case "getHistory":
                    let history = getStoredHistory()
                    responseData = [
                        "type": "getHistoryResponse",
                        "history": history
                    ]
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
    
    private func getBatteryStatus() -> (isCharging: Bool, level: Float, state: String) {
        os_log(.default, "getBatteryStatus called")
        
        // Enable battery monitoring
        UIDevice.current.isBatteryMonitoringEnabled = true
        
        let device = UIDevice.current
        let batteryLevel = device.batteryLevel
        let batteryState = device.batteryState
        
        var isCharging = false
        var stateString = "unknown"
        
        switch batteryState {
        case .charging:
            isCharging = true
            stateString = "charging"
        case .full:
            isCharging = true  // Device is plugged in when full
            stateString = "full"
        case .unplugged:
            isCharging = false
            stateString = "unplugged"
        case .unknown:
            isCharging = false
            stateString = "unknown"
        @unknown default:
            isCharging = false
            stateString = "unknown"
        }
        
        os_log(.default, "Battery details - level: %.2f, state: %@, charging: %@", 
               batteryLevel, stateString, isCharging ? "yes" : "no")
        
        return (isCharging: isCharging, level: batteryLevel, state: stateString)
    }
    
    private func updateLocalHistoryData(historyCount: Int, deviceId: String, lastSyncTime: TimeInterval?) {
        os_log(.default, "updateLocalHistoryData called: count=%d, device=%@", historyCount, deviceId)
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return
        }
        
        sharedDefaults.set(historyCount, forKey: "extensionHistoryCount")
        sharedDefaults.set(deviceId, forKey: "extensionDeviceId")
        
        if let lastSyncTime = lastSyncTime {
            sharedDefaults.set(lastSyncTime, forKey: "extensionLastSyncTime")
        }
        
        let syncResult = sharedDefaults.synchronize()
        os_log(.default, "Local history data update result: %@", syncResult ? "success" : "failed")
    }
    
    private func updateHistoryFromExtension(historyData: [[String: Any]], deviceId: String) -> Bool {
        os_log(.default, "updateHistoryFromExtension called with %d items from device %@", historyData.count, deviceId)
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return false
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: historyData)
            sharedDefaults.set(jsonData, forKey: "extensionHistoryData")
            sharedDefaults.set(historyData.count, forKey: "extensionHistoryCount")
            sharedDefaults.set(Date().timeIntervalSince1970, forKey: "extensionLastUpdate")
            
            let syncResult = sharedDefaults.synchronize()
            os_log(.default, "History update result: %@", syncResult ? "success" : "failed")
            
            // Notify iOS app of new history via notification
            NotificationCenter.default.post(name: Notification.Name("HistoryUpdatedFromExtension"), object: nil)
            
            return syncResult
        } catch {
            os_log(.error, "Failed to serialize history data: %@", error.localizedDescription)
            return false
        }
    }
    
    private func getStoredHistory() -> [[String: Any]] {
        os_log(.default, "getStoredHistory called")
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return []
        }
        
        guard let historyData = sharedDefaults.data(forKey: "extensionHistoryData") else {
            os_log(.default, "No stored history data found")
            return []
        }
        
        do {
            if let history = try JSONSerialization.jsonObject(with: historyData) as? [[String: Any]] {
                os_log(.default, "Retrieved %d history items from storage", history.count)
                return history
            } else {
                os_log(.error, "History data is not in expected format")
                return []
            }
        } catch {
            os_log(.error, "Failed to deserialize history data: %@", error.localizedDescription)
            return []
        }
    }

}
