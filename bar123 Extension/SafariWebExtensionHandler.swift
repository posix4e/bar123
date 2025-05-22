import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    static var shared = SafariWebExtensionHandler()
    
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any]
        os_log(.default, "Received message from extension: %@", message as! CVarArg)
        
        // Handle page visit data
        if let action = message?["action"] as? String, action == "pageVisit" {
            let url = message?["url"] as? String ?? ""
            let title = message?["title"] as? String ?? ""
            let timestamp = message?["timestamp"] as? String ?? ""
            
            // Store history data
            storeHistoryItem(url: url, title: title, timestamp: timestamp)
        }

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "Response to": message ] ]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    private func storeHistoryItem(url: String, title: String, timestamp: String) {
        var history = UserDefaults.standard.array(forKey: "browsing_history") as? [[String: String]] ?? []
        
        let historyItem = [
            "url": url,
            "title": title,
            "timestamp": timestamp
        ]
        
        history.append(historyItem)
        
        // Keep only last 100 items
        if history.count > 100 {
            history = Array(history.suffix(100))
        }
        
        UserDefaults.standard.set(history, forKey: "browsing_history")
        
        // Notify the app
        NotificationCenter.default.post(name: NSNotification.Name("HistoryUpdated"), object: nil)
    }

}