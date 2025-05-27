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

        var responseData: [String: Any] = ["echo": message]
        
        // Handle App Group storage messages
        if let messageDict = message as? [String: Any],
           let type = messageDict["type"] as? String {
            
            switch type {
            case "saveSharedSecret":
                if let secret = messageDict["secret"] as? String {
                    let success = saveSharedSecret(secret)
                    responseData = [
                        "type": "saveSharedSecretResponse",
                        "success": success
                    ]
                    os_log(.default, "Saved shared secret to App Group: %@", success ? "success" : "failed")
                }
            case "getSharedSecret":
                let secret = getSharedSecret()
                responseData = [
                    "type": "getSharedSecretResponse",
                    "secret": secret
                ]
                os_log(.default, "Retrieved shared secret from App Group: %@", secret.isEmpty ? "empty" : "found")
            default:
                responseData = ["echo": message]
            }
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
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            return false
        }
        
        if secret.isEmpty {
            sharedDefaults.removeObject(forKey: "roomSecret")
        } else {
            sharedDefaults.set(secret, forKey: "roomSecret")
        }
        
        return sharedDefaults.synchronize()
    }
    
    private func getSharedSecret() -> String {
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            return ""
        }
        
        return sharedDefaults.string(forKey: "roomSecret") ?? ""
    }

}
