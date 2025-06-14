import SwiftUI

struct ContentView: View {
    @AppStorage("encryptionSecret") private var encryptionSecret = ""
    @AppStorage("pantryID") private var pantryID = ""
    @AppStorage("pantryBasket") private var pantryBasket = "encrypted-history"
    @AppStorage("syncIntervalHours") private var syncIntervalHours = 1.0
    @State private var showingSecret = false
    @State private var isSyncing = false
    @State private var lastSyncTime: Date?
    @State private var refreshTimer: Timer?
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Encrypted History Settings")
                .font(.largeTitle)
                .padding()
            
            Form {
                Section(header: Text("Encryption")) {
                    HStack {
                        if showingSecret {
                            TextField("Encryption Secret", text: $encryptionSecret)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        } else {
                            SecureField("Encryption Secret", text: $encryptionSecret)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                        
                        Button(action: { showingSecret.toggle() }) {
                            Image(systemName: showingSecret ? "eye.slash" : "eye")
                        }
                    }
                    
                    Text("This secret is used to encrypt your browsing history")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section(header: Text("Pantry Configuration")) {
                    TextField("Pantry ID", text: $pantryID)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    TextField("Basket Name", text: $pantryBasket)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    Link("Get your Pantry ID", destination: URL(string: "https://getpantry.cloud")!)
                        .font(.caption)
                }
                
                Section(header: Text("Sync Settings")) {
                    VStack(alignment: .leading) {
                        Text("Sync Interval: \(Int(syncIntervalHours)) hour\(syncIntervalHours == 1 ? "" : "s")")
                        Slider(value: $syncIntervalHours, in: 0.5...24, step: 0.5)
                            .onChange(of: syncIntervalHours) { _ in
                                // Notify the history manager to update timer
                                NotificationCenter.default.post(name: NSNotification.Name("UpdateSyncInterval"), object: nil)
                            }
                    }
                    
                    Text("History older than 30 days is automatically removed")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section(header: Text("Sync Status")) {
                    if let lastSync = lastSyncTime {
                        Text("Last synced: \(lastSync, formatter: dateFormatter)")
                    } else {
                        Text("Not synced yet")
                    }
                    
                    Button(action: syncNow) {
                        if isSyncing {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                        } else {
                            Text("Sync Now")
                        }
                    }
                    .disabled(isSyncing || pantryID.isEmpty || encryptionSecret.isEmpty)
                }
            }
            .padding()
            
            Text("History syncs automatically based on your interval or when you have 100+ entries")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding()
        }
        .frame(minWidth: 500, minHeight: 400)
        .onAppear {
            loadLastSyncTime()
            // Update last sync time every 30 seconds
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
                loadLastSyncTime()
            }
        }
        .onDisappear {
            refreshTimer?.invalidate()
        }
    }
    
    private func syncNow() {
        isSyncing = true
        
        // Create and trigger sync directly
        let secret = encryptionSecret.isEmpty ? "default-secret-change-me" : encryptionSecret
        let historyManager = HistoryManager(secret: secret, pantryID: pantryID, pantryBasket: pantryBasket)
        
        Task {
            await historyManager.syncToPantry()
            
            DispatchQueue.main.async {
                self.isSyncing = false
                self.loadLastSyncTime()
            }
        }
    }
    
    private func loadLastSyncTime() {
        lastSyncTime = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date
    }
    
    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}