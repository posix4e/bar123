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

}
