//
//  SafariWebExtensionHandler.swift
//  bar123 Extension
//
//  Created by Alex Newman on 5/22/25.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    private let appGroupID = "group.xyz.foo.bar123"

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

        // Handle App Group storage messages
        if let messageDict = message as? [String: Any],
           let action = messageDict["action"] as? String {
            handleAppGroupMessage(action: action, data: messageDict, context: context)
            return
        }

        // Default echo response
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: [ "echo": message ] ]
        } else {
            response.userInfo = [ "message": [ "echo": message ] ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
    
    private func handleAppGroupMessage(action: String, data: [String: Any], context: NSExtensionContext) {
        switch action {
        case "setSharedSecret":
            if let secret = data["secret"] as? String {
                setSharedSecret(secret, context: context)
            } else {
                sendErrorResponse("Missing secret parameter", context: context)
            }
        case "getSharedSecret":
            getSharedSecret(context: context)
        default:
            sendErrorResponse("Unknown action: \(action)", context: context)
        }
    }
    
    private func setSharedSecret(_ secret: String, context: NSExtensionContext) {
        if let sharedDefaults = UserDefaults(suiteName: appGroupID) {
            sharedDefaults.set(secret, forKey: "sharedSecret")
            sharedDefaults.synchronize()
            
            os_log(.default, "Saved shared secret to App Group storage")
            
            let response = NSExtensionItem()
            let responseData: [String: Any] = ["success": true, "action": "setSharedSecret"]
            if #available(iOS 15.0, macOS 11.0, *) {
                response.userInfo = [ SFExtensionMessageKey: responseData ]
            } else {
                response.userInfo = [ "message": responseData ]
            }
            context.completeRequest(returningItems: [ response ], completionHandler: nil)
        } else {
            sendErrorResponse("Could not access App Group storage", context: context)
        }
    }
    
    private func getSharedSecret(context: NSExtensionContext) {
        if let sharedDefaults = UserDefaults(suiteName: appGroupID) {
            let secret = sharedDefaults.string(forKey: "sharedSecret") ?? ""
            
            os_log(.default, "Retrieved shared secret from App Group storage")
            
            let response = NSExtensionItem()
            let responseData: [String: Any] = [
                "success": true,
                "action": "getSharedSecret",
                "sharedSecret": secret
            ]
            if #available(iOS 15.0, macOS 11.0, *) {
                response.userInfo = [ SFExtensionMessageKey: responseData ]
            } else {
                response.userInfo = [ "message": responseData ]
            }
            context.completeRequest(returningItems: [ response ], completionHandler: nil)
        } else {
            sendErrorResponse("Could not access App Group storage", context: context)
        }
    }
    
    private func sendErrorResponse(_ error: String, context: NSExtensionContext) {
        os_log(.error, "App Group storage error: %@", error)
        
        let response = NSExtensionItem()
        let responseData: [String: Any] = ["success": false, "error": error]
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseData ]
        } else {
            response.userInfo = [ "message": responseData ]
        }
        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
