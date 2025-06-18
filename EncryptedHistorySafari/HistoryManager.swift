import Foundation
import CryptoKit
import SafariServices
import Compression

class HistoryManager {
    private let encryptionKey: SymmetricKey
    private let pantryBasket: String
    private let pantryID: String
    private var syncTimer: Timer?
    private let expirationDays = 30

    init(secret: String, pantryID: String, pantryBasket: String) {
        self.pantryID = pantryID
        self.pantryBasket = pantryBasket
        self.encryptionKey = SymmetricKey(data: SHA256.hash(data: secret.data(using: .utf8)!))

        // Start sync timer
        startSyncTimer()

        // Listen for sync interval updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updateSyncInterval),
            name: NSNotification.Name("UpdateSyncInterval"),
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func startSyncTimer() {
        syncTimer?.invalidate()

        let hours = UserDefaults.standard.double(forKey: "syncIntervalHours")
        let interval = hours > 0 ? hours * 3600 : 3600 // Default to 1 hour

        syncTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            Task {
                await self.syncToPantry()
            }
        }

        // Also sync immediately
        Task {
            await self.syncToPantry()
        }
    }

    @objc private func updateSyncInterval() {
        startSyncTimer()
    }

    func addHistoryEntry(_ entry: HistoryEntry) async {
        var entries = await loadLocalHistory()
        entries.append(entry)
        await saveLocalHistory(entries)

        // Sync if we have more than 100 entries or it's been more than a day
        if entries.count > 100 || shouldSyncBasedOnTime() {
            await syncToPantry()
        }
    }

    private func shouldSyncBasedOnTime() -> Bool {
        let lastSync = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date ?? Date.distantPast
        return Date().timeIntervalSince(lastSync) > 86400 // 24 hours
    }

    private func loadLocalHistory() async -> [HistoryEntry] {
        guard let data = UserDefaults.standard.data(forKey: "localHistory") else { return [] }

        do {
            let decrypted = try decrypt(data)
            var entries = try JSONDecoder().decode([HistoryEntry].self, from: decrypted)

            // Remove expired entries (older than 30 days)
            let cutoffDate = Calendar.current.date(byAdding: .day, value: -expirationDays, to: Date())!
            entries = entries.filter { $0.timestamp > cutoffDate }

            return entries
        } catch {
            print("Failed to load local history: \(error)")
            return []
        }
    }

    private func saveLocalHistory(_ entries: [HistoryEntry]) async {
        do {
            let data = try JSONEncoder().encode(entries)
            let encrypted = try encrypt(data)
            UserDefaults.standard.set(encrypted, forKey: "localHistory")
        } catch {
            print("Failed to save local history: \(error)")
        }
    }

    private func compress(_ data: Data) throws -> Data {
        return try (data as NSData).compressed(using: .zlib) as Data
    }

    private func decompress(_ data: Data) throws -> Data {
        return try (data as NSData).decompressed(using: .zlib) as Data
    }

    private func encrypt(_ data: Data) throws -> Data {
        let compressed = try compress(data)
        let sealed = try AES.GCM.seal(compressed, using: encryptionKey)
        return sealed.combined!
    }

    private func decrypt(_ data: Data) throws -> Data {
        let sealed = try AES.GCM.SealedBox(combined: data)
        let decrypted = try AES.GCM.open(sealed, using: encryptionKey)
        return try decompress(decrypted)
    }

    func syncToPantry() async {
        let entries = await loadLocalHistory()
        guard !entries.isEmpty else { return }

        do {
            // Group entries by day for more efficient storage
            let groupedEntries = groupEntriesByDay(entries)

            let data = try JSONEncoder().encode(groupedEntries)
            let encrypted = try encrypt(data)

            // Upload to Pantry
            let url = URL(string: "https://getpantry.cloud/apiv1/pantry/\(pantryID)/basket/\(pantryBasket)")!
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let payload = ["encryptedHistory": encrypted.base64EncodedString(),
                          "timestamp": ISO8601DateFormatter().string(from: Date()),
                          "deviceID": getDeviceID(),
                          "version": "2.0"] // Version to handle different data formats

            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                UserDefaults.standard.set(Date(), forKey: "lastSyncTime")
                print("Successfully synced to Pantry")
            }
        } catch {
            print("Failed to sync to Pantry: \(error)")
        }
    }

    private func groupEntriesByDay(_ entries: [HistoryEntry]) -> [String: [HistoryEntry]] {
        var grouped: [String: [HistoryEntry]] = [:]
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        for entry in entries {
            let dayKey = formatter.string(from: entry.timestamp)
            grouped[dayKey, default: []].append(entry)
        }

        return grouped
    }

    func fetchFromPantry() async -> [HistoryEntry] {
        do {
            let url = URL(string: "https://getpantry.cloud/apiv1/pantry/\(pantryID)/basket/\(pantryBasket)")!
            let (data, _) = try await URLSession.shared.data(from: url)

            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            guard let encryptedString = json?["encryptedHistory"] as? String,
                  let encryptedData = Data(base64Encoded: encryptedString) else {
                return []
            }

            let decrypted = try decrypt(encryptedData)
            var entries: [HistoryEntry] = []

            // Check version to handle different data formats
            let version = json?["version"] as? String ?? "1.0"

            if version == "2.0" {
                // New grouped format
                let grouped = try JSONDecoder().decode([String: [HistoryEntry]].self, from: decrypted)
                entries = grouped.values.flatMap { $0 }
            } else {
                // Old flat array format
                entries = try JSONDecoder().decode([HistoryEntry].self, from: decrypted)
            }

            // Remove expired entries (older than 30 days)
            let cutoffDate = Calendar.current.date(byAdding: .day, value: -expirationDays, to: Date())!
            entries = entries.filter { $0.timestamp > cutoffDate }

            return entries
        } catch {
            print("Failed to fetch from Pantry: \(error)")
            return []
        }
    }

    private func getDeviceID() -> String {
        if let id = UserDefaults.standard.string(forKey: "deviceID") {
            return id
        }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: "deviceID")
        return id
    }
}

struct HistoryEntry: Codable {
    let url: String
    let title: String
    let timestamp: Date
    let tabId: Int?
}
