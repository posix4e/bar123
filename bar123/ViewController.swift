//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false

        // Add message handlers for App Group storage access
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.configuration.userContentController.add(self, name: "sharedStorage")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization.
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "sharedStorage" {
            handleSharedStorageMessage(message)
        } else if message.name == "controller" {
            // Handle other controller messages
        }
    }
    
    private func handleSharedStorageMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("Invalid shared storage message format")
            return
        }
        
        switch action {
        case "getSharedSecret":
            getSharedSecret()
        case "setSharedSecret":
            if let secret = body["secret"] as? String {
                setSharedSecret(secret)
            }
        default:
            print("Unknown shared storage action: \(action)")
        }
    }
    
    private func getSharedSecret() {
        let appGroupID = "group.xyz.foo.bar123"
        
        // Try to access App Group shared storage
        if let sharedDefaults = UserDefaults(suiteName: appGroupID) {
            let sharedSecret = sharedDefaults.string(forKey: "sharedSecret")
            
            // Send result back to JavaScript
            let result: [String: Any] = [
                "action": "getSharedSecret",
                "success": true,
                "sharedSecret": sharedSecret ?? ""
            ]
            sendResultToJS(result)
        } else {
            // Fallback: no App Group access
            let result: [String: Any] = [
                "action": "getSharedSecret", 
                "success": false,
                "error": "Could not access App Group storage"
            ]
            sendResultToJS(result)
        }
    }
    
    private func setSharedSecret(_ secret: String) {
        let appGroupID = "group.xyz.foo.bar123"
        
        if let sharedDefaults = UserDefaults(suiteName: appGroupID) {
            sharedDefaults.set(secret, forKey: "sharedSecret")
            sharedDefaults.synchronize()
            
            let result: [String: Any] = [
                "action": "setSharedSecret",
                "success": true
            ]
            sendResultToJS(result)
        } else {
            let result: [String: Any] = [
                "action": "setSharedSecret",
                "success": false,
                "error": "Could not access App Group storage"
            ]
            sendResultToJS(result)
        }
    }
    
    private func sendResultToJS(_ result: [String: Any]) {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: result, options: [])
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                let script = "window.dispatchEvent(new CustomEvent('sharedStorageResponse', { detail: \(jsonString) }));"
                DispatchQueue.main.async {
                    self.webView.evaluateJavaScript(script) { (result, error) in
                        if let error = error {
                            print("Error sending result to JS: \(error)")
                        }
                    }
                }
            }
        } catch {
            print("Error serializing result to JSON: \(error)")
        }
    }

}
