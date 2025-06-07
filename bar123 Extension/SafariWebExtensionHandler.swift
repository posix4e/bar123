//
//  SafariWebExtensionHandler.swift
//  bar123 Extension
//
//  Created by Alex Newman on 5/22/25.
//

import SafariServices
import os.log
import Foundation

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // For now, we'll use UserDefaults to store history
    // In production, this would integrate with the main app's TorrentManager
    private let sharedSecretKey = "bar123_shared_secret"
    private let historyKey = "bar123_history"
    
    override init() {
        super.init()
    }

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

        // Handle different message types
        if let messageDict = message as? [String: Any],
           let action = messageDict["action"] as? String {
            
            Task {
                await handleAction(action, data: messageDict, context: context)
            }
        } else {
            // Echo response for backward compatibility
            let response = NSExtensionItem()
            if #available(iOS 15.0, macOS 11.0, *) {
                response.userInfo = [ SFExtensionMessageKey: [ "echo": message ] ]
            } else {
                response.userInfo = [ "message": [ "echo": message ] ]
            }
            context.completeRequest(returningItems: [ response ], completionHandler: nil)
        }
    }
    
    private func handleAction(_ action: String, data: [String: Any], context: NSExtensionContext) async {
        var responseData: [String: Any] = ["success": false]
        
        switch action {
        case "setSharedSecret":
            if let secret = data["secret"] as? String {
                UserDefaults.standard.set(secret, forKey: sharedSecretKey)
                responseData = ["success": true]
            }
            
        case "addHistory":
            if let url = data["url"] as? String,
               let title = data["title"] as? String,
               let timestamp = data["timestamp"] as? TimeInterval {
                
                let historyItem: [String: Any] = [
                    "url": url,
                    "title": title,
                    "timestamp": timestamp,
                    "deviceName": ProcessInfo.processInfo.hostName,
                    "deviceModel": "Safari Extension",
                    "deviceId": UUID().uuidString
                ]
                
                // Store in shared UserDefaults for now
                var history = UserDefaults.standard.array(forKey: historyKey) as? [[String: Any]] ?? []
                history.append(historyItem)
                UserDefaults.standard.set(history, forKey: historyKey)
                
                responseData = ["success": true]
            }
            
        case "searchHistory":
            if let query = data["query"] as? String {
                let history = UserDefaults.standard.array(forKey: historyKey) as? [[String: Any]] ?? []
                let results = history.filter { item in
                    let url = item["url"] as? String ?? ""
                    let title = item["title"] as? String ?? ""
                    return url.localizedCaseInsensitiveContains(query) || 
                           title.localizedCaseInsensitiveContains(query)
                }
                responseData = ["success": true, "results": results]
            }
            
        case "getDevices":
            // Get unique devices from history
            let history = UserDefaults.standard.array(forKey: historyKey) as? [[String: Any]] ?? []
            var deviceSet = Set<String>()
            var devices: [[String: String]] = []
            
            for item in history {
                if let deviceId = item["deviceId"] as? String,
                   !deviceSet.contains(deviceId) {
                    deviceSet.insert(deviceId)
                    devices.append([
                        "name": item["deviceName"] as? String ?? "Unknown",
                        "model": item["deviceModel"] as? String ?? "Unknown",
                        "osVersion": "iOS"
                    ])
                }
            }
            responseData = ["success": true, "devices": devices]
            
        case "getSyncStatus":
            responseData = [
                "success": true,
                "syncing": UserDefaults.standard.string(forKey: sharedSecretKey) != nil,
                "hasSharedSecret": UserDefaults.standard.string(forKey: sharedSecretKey) != nil
            ]
            
        default:
            responseData = ["success": false, "error": "Unknown action: \(action)"]
        }
        
        // Send response
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseData ]
        } else {
            response.userInfo = [ "message": responseData ]
        }
        
        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
