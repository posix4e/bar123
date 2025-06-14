// Background script for capturing browser history

// Configuration
const ExtensionConfig = {
    // This should match AppConfiguration.nativeMessageAppID
    nativeAppId: 'com.apple-6746350013.bar123'
};

// Initialize extension
browser.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed, initializing...');
});

// Get device info
function getDeviceInfo() {
    return {
        browser: 'Safari',
        platform: navigator.platform || 'Unknown',
        userAgent: navigator.userAgent,
        deviceType: 'Safari Browser'
    };
}

// Listen for history visits and send to Swift immediately
browser.history.onVisited.addListener(async (historyItem) => {
    console.log('New history item:', historyItem);
    
    // Add device info to history item
    const deviceInfo = getDeviceInfo();
    
    // Send to native app for storage and sync handling
    try {
        await browser.runtime.sendNativeMessage(
            ExtensionConfig.nativeAppId,
            {
                action: 'addHistoryItem',
                data: [{
                    url: historyItem.url,
                    title: historyItem.title || '',
                    visitTime: historyItem.lastVisitTime,
                    id: historyItem.id,
                    deviceInfo: deviceInfo
                }]
            }
        );
    } catch (error) {
        console.error('Failed to send history to native app:', error);
    }
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    switch (message.action) {
        case 'getHistory':
            getStoredHistory(message.limit).then(sendResponse);
            return true;
            
        case 'getRecentHistory':
            getRecentHistory(message.hoursAgo, message.limit).then(sendResponse);
            return true;
            
        case 'searchHistory':
            searchHistory(message.query, message.searchType, message.limit).then(sendResponse);
            return true;
            
        case 'getStatus':
            getStatus().then(sendResponse);
            return true;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Get stored history from native app
async function getStoredHistory(limit = 100) {
    try {
        const response = await browser.runtime.sendNativeMessage(
            ExtensionConfig.nativeAppId,
            {
                action: 'getHistory',
                limit: limit
            }
        );
        
        return response;
    } catch (error) {
        console.error('Error fetching history:', error);
        return { error: error.message };
    }
}

// Get recent history from native app
async function getRecentHistory(hoursAgo = 24, limit = 50) {
    try {
        const response = await browser.runtime.sendNativeMessage(
            ExtensionConfig.nativeAppId,
            {
                action: 'getRecentHistory',
                hoursAgo: hoursAgo,
                limit: limit
            }
        );
        
        return response;
    } catch (error) {
        console.error('Error fetching recent history:', error);
        return { error: error.message };
    }
}

// Search history via native app
async function searchHistory(query, searchType = 'all', limit = 100) {
    try {
        const response = await browser.runtime.sendNativeMessage(
            ExtensionConfig.nativeAppId,
            {
                action: 'searchHistory',
                query: query,
                searchType: searchType,
                limit: limit
            }
        );
        
        return response;
    } catch (error) {
        console.error('Error searching history:', error);
        return { error: error.message };
    }
}

// Get sync status from native app
async function getStatus() {
    try {
        const response = await browser.runtime.sendNativeMessage(
            ExtensionConfig.nativeAppId,
            {
                action: 'getStatus'
            }
        );
        
        return response;
    } catch (error) {
        console.error('Error getting status:', error);
        return { error: error.message };
    }
}

