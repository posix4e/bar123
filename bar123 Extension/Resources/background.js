console.log("🔥 BAR123 EXTENSION: Background script loaded");

// Store history item in browser storage
function storeHistoryItem(url, title, timestamp) {
    browser.storage.local.get(['browsing_history']).then((result) => {
        let history = result.browsing_history || [];
        
        const historyItem = { url, title, timestamp };
        history.push(historyItem);
        
        // Keep only last 100 items
        if (history.length > 100) {
            history = history.slice(-100);
        }
        
        browser.storage.local.set({ browsing_history: history }).then(() => {
            console.log("🔥 BAR123: History stored:", historyItem);
        });
    });
}

// Simple page visit logging and send to app
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log("🔥 BAR123: Page visited:", tab.url);
        console.log("🔥 BAR123: Page title:", tab.title);
        
        const visitData = {
            action: "pageVisit",
            url: tab.url,
            title: tab.title || "No title",
            timestamp: new Date().toISOString()
        };
        
        // Store in browser storage for popup
        storeHistoryItem(visitData.url, visitData.title, visitData.timestamp);
        
        // Send visit data to native app using Safari's messaging
        browser.runtime.sendMessage(visitData).then((response) => {
            console.log("🔥 BAR123: Sent to app:", visitData);
        }).catch((error) => {
            console.log("🔥 BAR123: Error sending to app:", error);
        });
    }
});

// Log when extension starts
console.log("🔥 BAR123: Extension is now active and monitoring page visits");