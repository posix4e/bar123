//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import CryptoKit
import os.log
import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    @IBOutlet var webView: WKWebView!
    
    // Simplified components - JavaScript handles P2P connections
    private var isConnected = false
    private var peerCount = 0
    private var currentRoomId: String?
    
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "ViewController")

    override func viewDidLoad() {
        super.viewDidLoad()

        setupWebView()
        
        logger.info("ViewController initialized with JavaScript P2P")
    }
    
    private func setupWebView() {
        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false
        
        // Enable JavaScript debugging
        if #available(iOS 16.4, *) {
            self.webView.isInspectable = true
        }
        
        // Add message handler
        self.webView.configuration.userContentController.add(self, name: "controller")
        
        // Enable local file access and JavaScript
        self.webView.configuration.preferences.javaScriptEnabled = true
        self.webView.configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        
        // Load the HTML file with proper access to resources
        if let htmlURL = Bundle.main.url(forResource: "Main", withExtension: "html", subdirectory: "Base.lproj") {
            if let resourceURL = Bundle.main.resourceURL {
                self.webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
            }
            logger.info("Loading HTML from: \(htmlURL.path)")
        } else {
            logger.error("Failed to find Main.html in bundle")
        }
    }
    
    private func checkForExistingRoomSecret() {
        let secret = getSharedSecret()
        if !secret.isEmpty {
            logger.info("Found existing room secret, letting JavaScript handle connection")
            showHistoryViewer()
            // Send secret to JavaScript
            sendSecretToJavaScript(secret)
        } else {
            logger.info("No room secret found, showing setup view")
            showSetupView()
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
        // WebView has loaded, wait a moment for JavaScript to initialize
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.checkForExistingRoomSecret()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        logger.info("📨 Received message from JavaScript: \(String(describing: message.body))")
        
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            logger.error("❌ Invalid message format from JavaScript")
            return
        }
        
        logger.info("📋 Processing message type: \(type)")
        
        switch type {
        case "getSharedSecret":
            handleGetSharedSecret()
        case "setSharedSecret":
            if let secret = body["secret"] as? String {
                handleSetSharedSecret(secret)
            }
        case "clearRoomSecret":
            handleClearRoomSecret()
        case "connectionStatusUpdate":
            handleConnectionStatusUpdate(body)
        case "peerJoined", "peerLeft":
            handlePeerUpdate(body)
        case "historyUpdated":
            handleHistoryUpdate(body)
        case "openSafariExtension":
            handleOpenSafariExtension()
        default:
            logger.warning("Unknown message type: \(type)")
        }
    }
    
    private func handleGetSharedSecret() {
        let secret = getSharedSecret()
        
        if !secret.isEmpty {
            logger.info("Room secret found during manual check, switching to history viewer")
            showHistoryViewer()
            sendSecretToJavaScript(secret)
        } else {
            logger.info("No room secret found during manual check")
            showSetupView()
        }
    }
    
    private func handleSetSharedSecret(_ secret: String) {
        logger.info("🔐 handleSetSharedSecret called with secret: '\(secret)'")
        
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        if secret.isEmpty {
            logger.info("🗑️ Clearing secret and showing setup view")
            sharedDefaults?.removeObject(forKey: "roomSecret")
            showSetupView()
        } else {
            logger.info("💾 Saving secret and switching to history viewer")
            sharedDefaults?.set(secret, forKey: "roomSecret")
            showHistoryViewer()
            sendSecretToJavaScript(secret)
        }
        
        sharedDefaults?.synchronize()
        logger.info("✅ Shared secret updated: \(secret.isEmpty ? "cleared" : "set")")
    }
    
    // MARK: - JavaScript Communication Handlers
    
    private func handleClearRoomSecret() {
        logger.info("JavaScript requested to clear room secret")
        handleSetSharedSecret("")
    }
    
    private func handleConnectionStatusUpdate(_ body: [String: Any]) {
        if let connected = body["isConnected"] as? Bool {
            isConnected = connected
        }
        if let peers = body["peerCount"] as? Int {
            peerCount = peers
        }
        if let roomId = body["roomId"] as? String {
            currentRoomId = roomId
        }
        
        logger.info("Connection status updated: connected=\(self.isConnected), peers=\(self.peerCount)")
    }
    
    private func handlePeerUpdate(_ body: [String: Any]) {
        if let peers = body["peerCount"] as? Int {
            peerCount = peers
        }
        logger.info("Peer count updated: \(self.peerCount)")
    }
    
    private func handleHistoryUpdate(_ body: [String: Any]) {
        if let newEntries = body["newEntries"] as? Int,
           let totalEntries = body["totalEntries"] as? Int {
            logger.info("History updated: +\(newEntries) new entries, \(totalEntries) total")
        }
    }
    
    private func handleOpenSafariExtension() {
        logger.info("Opening Safari extension settings")
        
        // Try opening Safari directly first
        if let safariURL = URL(string: "https://www.google.com") {
            UIApplication.shared.open(safariURL) { success in
                if success {
                    self.logger.info("Successfully opened Safari")
                    
                    // Show instructions to user
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.showSafariInstructions()
                    }
                } else {
                    self.logger.error("Failed to open Safari")
                }
            }
        }
    }
    
    // MARK: - View Management
    
    private func showHistoryViewer() {
        let script = """
            document.getElementById('setup-view').style.display = 'none';
            document.getElementById('history-viewer').style.display = 'block';
        """
        executeJavaScript(script)
    }
    
    private func showSetupView() {
        let script = """
            document.getElementById('setup-view').style.display = 'block';
            document.getElementById('history-viewer').style.display = 'none';
        """
        executeJavaScript(script)
    }
    
    private func showSafariInstructions() {
        let alert = UIAlertController(
            title: "Safari Extension Setup",
            message: "1. Tap the 'AA' button in Safari's address bar\n2. Select 'bar123'\n3. Set your room secret\n4. Return to this app",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        
        DispatchQueue.main.async {
            self.present(alert, animated: true)
        }
    }
    
    // MARK: - Helper Methods
    
    private func sendSecretToJavaScript(_ secret: String) {
        let message = [
            "type": "sharedSecretResponse",
            "secret": secret
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            logger.error("Failed to serialize secret message")
            return
        }
        
        logger.info("Sending secret to JavaScript: \(secret.isEmpty ? "empty" : "set")")
        executeJavaScript("window.postMessage(\(jsonString), '*');")
    }
    
    private func executeJavaScript(_ script: String) {
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(script) { (_, error) in
                if let error = error {
                    self.logger.error("JavaScript execution error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func getSharedSecret() -> String {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        return sharedDefaults?.string(forKey: "roomSecret") ?? ""
    }
}
