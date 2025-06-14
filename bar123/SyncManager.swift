import Foundation
import CryptoKit
import os.log
import UIKit

class SyncManager {
    static let shared = SyncManager()
    
    private let logger = Logger(subsystem: AppConfiguration.logSubsystem, category: "SyncManager")
    private let encryptionKey = SymmetricKey(size: .bits256)
    private var syncTimer: Timer?
    private let historyDataManager = HistoryDataManager.shared
    
    // User-configurable settings
    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
    }
    
    private var pantryID: String {
        sharedDefaults?.string(forKey: "pantryID") ?? ""
    }
    
    private var basketName: String {
        sharedDefaults?.string(forKey: "basketName") ?? "browser-history"
    }
    
    private var syncInterval: TimeInterval {
        TimeInterval(sharedDefaults?.integer(forKey: "syncInterval") ?? 3600)
    }
    
    private var pantryBaseURL: String {
        "https://getpantry.cloud/apiv1/pantry"
    }
    
    private init() {
        setupSyncTimer()
        
        // Listen for settings changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(settingsChanged),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
    }
    
    // MARK: - Public Methods
    
    func startSync() {
        setupSyncTimer()
    }
    
    func stopSync() {
        syncTimer?.invalidate()
        syncTimer = nil
    }
    
    func forceSyncNow() async -> (success: Bool, syncedCount: Int, error: String?) {
        guard !pantryID.isEmpty else {
            return (false, 0, "Pantry ID not configured")
        }
        
        do {
            // Get unsynced items
            let unsyncedItems = historyDataManager.getUnsyncedItems()
            
            if unsyncedItems.isEmpty {
                return (true, 0, nil)
            }
            
            // Convert to dictionary array for JSON serialization
            let historyData: [[String: Any]] = unsyncedItems.map { item in
                var data: [String: Any] = [
                    "url": item.url as Any,
                    "title": item.title as Any,
                    "visitTime": item.visitTime?.timeIntervalSince1970 as Any,
                    "id": item.id ?? UUID().uuidString
                ]
                
                // Add device info if available
                if let deviceType = item.deviceType {
                    data["deviceInfo"] = [
                        "browser": item.deviceBrowser ?? "Unknown",
                        "platform": item.devicePlatform ?? "Unknown",
                        "deviceType": deviceType
                    ]
                }
                
                return data
            }
            
            // Encrypt and upload
            let encryptedData = try encryptHistoryData(historyData)
            let success = await uploadToPantry(encryptedData: encryptedData)
            
            if success {
                // Mark items as synced
                historyDataManager.markItemsAsSynced(unsyncedItems)
                
                // Update last sync time
                sharedDefaults?.set(Date(), forKey: "lastSyncTime")
                
                logger.info("Successfully synced \(unsyncedItems.count) items")
                return (true, unsyncedItems.count, nil)
            } else {
                return (false, 0, "Failed to upload to Pantry")
            }
        } catch {
            logger.error("Sync failed: \(error.localizedDescription)")
            return (false, 0, error.localizedDescription)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupSyncTimer() {
        syncTimer?.invalidate()
        
        guard !pantryID.isEmpty, syncInterval > 0 else {
            logger.info("Sync timer not started: Pantry not configured or invalid interval")
            return
        }
        
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { [weak self] _ in
            Task {
                await self?.performBackgroundSync()
            }
        }
        
        logger.info("Sync timer started with interval: \(self.syncInterval) seconds")
    }
    
    @objc private func settingsChanged() {
        // Restart timer with new settings
        setupSyncTimer()
    }
    
    private func performBackgroundSync() async {
        logger.info("Performing background sync")
        let result = await forceSyncNow()
        
        if result.success {
            logger.info("Background sync completed: \(result.syncedCount) items synced")
        } else {
            logger.error("Background sync failed: \(result.error ?? "Unknown error")")
        }
    }
    
    // MARK: - Encryption
    
    private func encryptHistoryData(_ data: [[String: Any]]) throws -> Data {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(jsonData, using: encryptionKey, nonce: nonce)
        
        var encryptedData = Data()
        encryptedData.append(nonce.withUnsafeBytes { Data($0) })
        encryptedData.append(sealedBox.ciphertext)
        encryptedData.append(sealedBox.tag)
        
        return encryptedData
    }
    
    // MARK: - Pantry Integration
    
    private func uploadToPantry(encryptedData: Data) async -> Bool {
        guard let url = URL(string: "\(pantryBaseURL)/\(pantryID)/basket/\(basketName)") else {
            logger.error("Invalid Pantry URL")
            return false
        }
        
        let payload: [String: Any] = [
            "encryptedData": encryptedData.base64EncodedString(),
            "timestamp": Date().timeIntervalSince1970,
            "version": "1.0",
            "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload) else {
            logger.error("Failed to create JSON payload")
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                logger.info("Pantry upload response: \(httpResponse.statusCode)")
                return httpResponse.statusCode == 200
            }
        } catch {
            logger.error("Pantry upload failed: \(error.localizedDescription)")
        }
        
        return false
    }
    
    // MARK: - Download from Pantry (for multi-device sync)
    
    func downloadFromPantry() async -> Bool {
        guard let url = URL(string: "\(pantryBaseURL)/\(pantryID)/basket/\(basketName)") else {
            logger.error("Invalid Pantry URL")
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                // Parse and decrypt data
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let encryptedDataString = json["encryptedData"] as? String,
                   let encryptedData = Data(base64Encoded: encryptedDataString) {
                    
                    // Decrypt and merge with local data
                    if let _ = try? decryptHistoryData(encryptedData) {
                        // TODO: Merge with local history, avoiding duplicates
                        logger.info("Successfully downloaded and decrypted history from Pantry")
                        return true
                    }
                }
            }
        } catch {
            logger.error("Pantry download failed: \(error.localizedDescription)")
        }
        
        return false
    }
    
    private func decryptHistoryData(_ encryptedData: Data) throws -> [[String: Any]] {
        guard encryptedData.count > 12 else {
            throw EncryptionError.invalidData
        }
        
        let nonceData = encryptedData.prefix(12)
        let ciphertextAndTag = encryptedData.dropFirst(12)
        
        guard let nonce = try? AES.GCM.Nonce(data: nonceData) else {
            throw EncryptionError.invalidData
        }
        
        let sealedBox = try AES.GCM.SealedBox(
            nonce: nonce,
            ciphertext: ciphertextAndTag.dropLast(16),
            tag: ciphertextAndTag.suffix(16)
        )
        
        let decryptedData = try AES.GCM.open(sealedBox, using: encryptionKey)
        let historyData = try JSONSerialization.jsonObject(with: decryptedData) as? [[String: Any]]
        
        return historyData ?? []
    }
}

// MARK: - Custom Errors
enum EncryptionError: Error {
    case invalidData
    case encryptionFailed
    case decryptionFailed
}