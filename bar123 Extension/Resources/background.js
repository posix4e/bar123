// Background script for encrypted history storage

// Configuration
const DEFAULT_SYNC_INTERVAL = 3600000; // 1 hour in milliseconds
const MIN_SYNC_INTERVAL = 1800000; // 0.5 hours (30 minutes)
const MAX_SYNC_INTERVAL = 86400000; // 24 hours
const STORAGE_KEYS = {
    syncInterval: 'syncInterval',
    lastSyncTime: 'lastSyncTime'
};

// Initialize extension
browser.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed, initializing...');
    
    // Set default sync interval if not already set
    const stored = await browser.storage.local.get(STORAGE_KEYS.syncInterval);
    if (!stored.syncInterval) {
        await browser.storage.local.set({ 
            [STORAGE_KEYS.syncInterval]: DEFAULT_SYNC_INTERVAL 
        });
    }
    
    // Schedule sync alarm
    scheduleSyncAlarm();
});

// Listen for history visits and send to Swift immediately
browser.history.onVisited.addListener(async (historyItem) => {
    console.log('New history item:', historyItem);
    
    // Send to native app for storage
    try {
        await browser.runtime.sendNativeMessage(
            'com.apple-6746350013.bar123',
            {
                action: 'addHistoryItem',
                data: [{
                    url: historyItem.url,
                    title: historyItem.title || '',
                    visitTime: historyItem.lastVisitTime,
                    id: historyItem.id
                }]
            }
        );
    } catch (error) {
        console.error('Failed to send history to native app:', error);
    }
});

// Schedule sync alarm
async function scheduleSyncAlarm() {
    const stored = await browser.storage.local.get(STORAGE_KEYS.syncInterval);
    const interval = stored.syncInterval || DEFAULT_SYNC_INTERVAL;
    
    // Clear existing alarm
    await browser.alarms.clear('syncHistory');
    
    // Create new alarm
    browser.alarms.create('syncHistory', {
        periodInMinutes: interval / 60000
    });
}

// Handle alarms
browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncHistory') {
        syncHistoryToNative();
    }
});

// Sync history to Pantry (trigger sync on native side)
async function syncHistoryToNative() {
    console.log('Triggering history sync...');
    
    try {
        const response = await browser.runtime.sendNativeMessage(
            'com.apple-6746350013.bar123',
            {
                action: 'syncHistory'
            }
        );
        
        if (response && response.success) {
            await browser.storage.local.set({
                [STORAGE_KEYS.lastSyncTime]: Date.now()
            });
            
            console.log(`History sync successful. Synced ${response.syncedCount || 0} items.`);
        } else {
            console.error('History sync failed:', response?.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error syncing history:', error);
    }
}

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    switch (message.action) {
        case 'getStatus':
            getExtensionStatus().then(sendResponse);
            return true; // Will respond asynchronously
            
        case 'forceSync':
            syncHistoryToNative().then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'updateSyncInterval':
            updateSyncInterval(message.interval).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'getHistory':
            getStoredHistory(message.limit).then(sendResponse);
            return true;
            
        case 'getRecentHistory':
            getRecentHistory(message.hoursAgo, message.limit).then(sendResponse);
            return true;
            
        case 'searchHistory':
            searchHistory(message.query, message.searchType, message.limit).then(sendResponse);
            return true;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Get extension status
async function getExtensionStatus() {
    const stored = await browser.storage.local.get([
        STORAGE_KEYS.syncInterval,
        STORAGE_KEYS.lastSyncTime
    ]);
    
    // Get pending count from native app
    let pendingCount = 0;
    try {
        const response = await browser.runtime.sendNativeMessage(
            'com.apple-6746350013.bar123',
            {
                action: 'getStatus'
            }
        );
        pendingCount = response?.pendingCount || 0;
    } catch (error) {
        console.error('Failed to get status from native app:', error);
    }
    
    return {
        syncInterval: stored.syncInterval || DEFAULT_SYNC_INTERVAL,
        lastSyncTime: stored.lastSyncTime || null,
        pendingCount: pendingCount
    };
}

// Update sync interval
async function updateSyncInterval(interval) {
    if (interval < MIN_SYNC_INTERVAL || interval > MAX_SYNC_INTERVAL) {
        throw new Error('Invalid sync interval');
    }
    
    await browser.storage.local.set({
        [STORAGE_KEYS.syncInterval]: interval
    });
    
    // Reschedule alarm
    await scheduleSyncAlarm();
}

// Get stored history from native app
async function getStoredHistory(limit = 100) {
    try {
        const response = await browser.runtime.sendNativeMessage(
            'com.apple-6746350013.bar123',
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
            'com.apple-6746350013.bar123',
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
            'com.apple-6746350013.bar123',
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

// Clean up old history periodically
browser.alarms.create('cleanupHistory', {
    periodInMinutes: 1440 // Once per day
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupHistory') {
        cleanupOldHistory();
    }
});

async function cleanupOldHistory() {
    try {
        await browser.runtime.sendNativeMessage(
            'com.apple-6746350013.bar123',
            {
                action: 'cleanupHistory',
                expirationDays: 30
            }
        );
    } catch (error) {
        console.error('Error cleaning up history:', error);
    }
}