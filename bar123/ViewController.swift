import UIKit
import WebKit

extension Date {
    var ISO8601String: String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}

class ViewController: UIViewController {
    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        webView.navigationDelegate = self
        setupWebViewMessageHandler()
        
        // Listen for history updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(historyUpdated),
            name: NSNotification.Name("HistoryUpdated"),
            object: nil
        )
        
        webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }
    
    private func setupWebViewMessageHandler() {
        let contentController = webView.configuration.userContentController
        contentController.add(self, name: "getHistory")
        contentController.add(self, name: "saveP2PSettings")
        contentController.add(self, name: "loadP2PSettings")
    }
    
    @objc private func historyUpdated() {
        // Refresh history display
        loadHistory()
    }
    
    private func loadHistory() {
        let history = UserDefaults.standard.array(forKey: "browsing_history") as? [[String: String]] ?? []
        let historyJSON = try? JSONSerialization.data(withJSONObject: history)
        let historyString = String(data: historyJSON ?? Data(), encoding: .utf8) ?? "[]"
        
        let script = "updateHistory(\(historyString));"
        webView.evaluateJavaScript(script)
    }
}

extension ViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Load history when page is ready
        loadHistory()
    }
}

extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "getHistory":
            loadHistory()
        case "saveP2PSettings":
            if let settings = message.body as? [String: Any] {
                saveP2PSettings(settings)
            }
        case "loadP2PSettings":
            loadP2PSettings()
        default:
            break
        }
    }
    
    private func saveP2PSettings(_ settings: [String: Any]) {
        UserDefaults.standard.set(settings, forKey: "p2p_settings")
        print("P2P settings saved: \(settings)")
    }
    
    private func loadP2PSettings() {
        let settings = UserDefaults.standard.dictionary(forKey: "p2p_settings") ?? [:]
        let settingsJSON = try? JSONSerialization.data(withJSONObject: settings)
        let settingsString = String(data: settingsJSON ?? Data(), encoding: .utf8) ?? "{}"
        
        let script = "window.loadedP2PSettings = \(settingsString); console.log('P2P settings loaded:', window.loadedP2PSettings);"
        webView.evaluateJavaScript(script)
    }
}
