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

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization.
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }
        
        switch type {
        case "getSharedSecret":
            handleGetSharedSecret()
        case "setSharedSecret":
            if let secret = body["secret"] as? String {
                handleSetSharedSecret(secret)
            }
        default:
            print("Unknown message type: \(type)")
        }
    }
    
    private func handleGetSharedSecret() {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        let secret = sharedDefaults?.string(forKey: "roomSecret") ?? ""
        
        let response = [
            "type": "sharedSecretResponse",
            "secret": secret
        ]
        
        let jsonData = try? JSONSerialization.data(withJSONObject: response)
        let jsonString = jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        
        self.webView.evaluateJavaScript("window.postMessage(\(jsonString), '*');") { (result, error) in
            if let error = error {
                print("Error sending message to WebView: \(error)")
            }
        }
    }
    
    private func handleSetSharedSecret(_ secret: String) {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        if secret.isEmpty {
            sharedDefaults?.removeObject(forKey: "roomSecret")
        } else {
            sharedDefaults?.set(secret, forKey: "roomSecret")
        }
        
        sharedDefaults?.synchronize()
        print("Shared secret updated: \(secret.isEmpty ? "cleared" : "set")")
    }

}
