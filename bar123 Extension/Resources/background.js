// History sync manager
class HistorySyncManager {
    constructor() {
        this.nativeAppId = "xyz.foo.bar123.Extension";
        this.initializeListeners();
    }

    async initializeListeners() {
        // Listen for page visits from content scripts
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("Received request: ", request);

            if (request.action === "pageVisited") {
                this.handlePageVisit(request.data);
                return Promise.resolve({ success: true });
            }
            
            if (request.greeting === "hello") {
                return Promise.resolve({ farewell: "goodbye" });
            }
        });

        // Listen for history changes
        if (browser.history && browser.history.onVisited) {
            browser.history.onVisited.addListener((historyItem) => {
                this.handleHistoryItem(historyItem);
            });
        }

        // Check sync status on startup
        await this.checkSyncStatus();
    }

    async handlePageVisit(data) {
        // Send history item to native app
        const message = {
            action: "addHistory",
            url: data.url,
            title: data.title,
            timestamp: Date.now() / 1000
        };

        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, message);
            console.log("Native response:", response);
        } catch (error) {
            console.error("Error sending to native app:", error);
        }
    }

    async handleHistoryItem(historyItem) {
        // Handle browser history API events
        const message = {
            action: "addHistory",
            url: historyItem.url,
            title: historyItem.title || "",
            timestamp: historyItem.lastVisitTime / 1000
        };

        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, message);
            console.log("Native response:", response);
        } catch (error) {
            console.error("Error sending to native app:", error);
        }
    }

    async checkSyncStatus() {
        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "getSyncStatus"
            });
            console.log("Sync status:", response);
            
            // Store status for popup
            await browser.storage.local.set({ syncStatus: response });
        } catch (error) {
            console.error("Error checking sync status:", error);
        }
    }

    async searchHistory(query) {
        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "searchHistory",
                query: query
            });
            return response.results || [];
        } catch (error) {
            console.error("Error searching history:", error);
            return [];
        }
    }

    async getDevices() {
        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "getDevices"
            });
            return response.devices || [];
        } catch (error) {
            console.error("Error getting devices:", error);
            return [];
        }
    }

    async setSharedSecret(secret) {
        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "setSharedSecret",
                secret: secret
            });
            
            // Update sync status
            await this.checkSyncStatus();
            
            return response.success;
        } catch (error) {
            console.error("Error setting shared secret:", error);
            return false;
        }
    }
}

// Initialize the sync manager
const syncManager = new HistorySyncManager();

// Export for popup and other scripts
window.syncManager = syncManager;
