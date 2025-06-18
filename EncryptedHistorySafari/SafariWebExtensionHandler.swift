import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let historyManager: HistoryManager

    override init() {
        // Load configuration
        let secret = UserDefaults.standard.string(forKey: "encryptionSecret") ?? "default-secret-change-me"
        let pantryID = UserDefaults.standard.string(forKey: "pantryID") ?? ""
        let pantryBasket = UserDefaults.standard.string(forKey: "pantryBasket") ?? "encrypted-history"

        self.historyManager = HistoryManager(secret: secret, pantryID: pantryID, pantryBasket: pantryBasket)
        super.init()
    }

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: ["error": "Invalid input"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            return
        }
        let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any]
        let response = NSExtensionItem()

        guard let action = message?["action"] as? String else {
            response.userInfo = [SFExtensionMessageKey: ["error": "No action specified"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            return
        }

        switch action {
        case "addHistory":
            handleAddHistory(message: message, response: response, context: context)

        case "getHistory":
            handleGetHistory(message: message, response: response, context: context)

        case "sync":
            handleSync(response: response, context: context)

        default:
            response.userInfo = [SFExtensionMessageKey: ["error": "Unknown action"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    private func handleAddHistory(message: [String: Any]?, response: NSExtensionItem, context: NSExtensionContext) {
        guard let data = message?["data"] as? [String: Any],
              let url = data["url"] as? String,
              let title = data["title"] as? String,
              let timestamp = data["timestamp"] as? Double else {
            response.userInfo = [SFExtensionMessageKey: ["error": "Invalid history data"]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            return
        }

        let entry = HistoryEntry(
            url: url,
            title: title,
            timestamp: Date(timeIntervalSince1970: timestamp / 1000),
            tabId: data["tabId"] as? Int
        )

        Task {
            await historyManager.addHistoryEntry(entry)
            response.userInfo = [SFExtensionMessageKey: ["success": true]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    private func handleGetHistory(message: [String: Any]?, response: NSExtensionItem, context: NSExtensionContext) {
        Task {
            let entries = await historyManager.fetchFromPantry()
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .millisecondsSince1970

            if let data = try? encoder.encode(entries),
               let json = try? JSONSerialization.jsonObject(with: data) {
                response.userInfo = [SFExtensionMessageKey: ["history": json]]
            } else {
                response.userInfo = [SFExtensionMessageKey: ["history": []]]
            }

            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    private func handleSync(response: NSExtensionItem, context: NSExtensionContext) {
        Task {
            await historyManager.syncToPantry()
            response.userInfo = [SFExtensionMessageKey: ["success": true]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }
}
