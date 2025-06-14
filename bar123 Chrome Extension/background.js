// Chrome Extension Background Script for bar123 History Sync

// Default configuration
const DEFAULT_CONFIG = {
    pantryId: '',
    basketName: 'browserHistory',
    syncInterval: 3600, // 1 hour in seconds
    enableSync: false
};

// Encryption utilities
async function generateKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('bar123-history-sync-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(data, key) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(JSON.stringify(data))
    );
    
    // Combine iv and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedBase64, key) {
    try {
        // Convert from base64
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        // Extract iv and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// Get device info
function getDeviceInfo() {
    return {
        browser: 'Chrome',
        platform: navigator.platform || 'Unknown',
        userAgent: navigator.userAgent,
        deviceType: 'Chrome Browser'
    };
}

// Load configuration
async function loadConfig() {
    const result = await chrome.storage.local.get(['config']);
    return result.config || DEFAULT_CONFIG;
}

// Save configuration
async function saveConfig(config) {
    await chrome.storage.local.set({ config });
}

// Get last sync time
async function getLastSyncTime() {
    const result = await chrome.storage.local.get(['lastSyncTime']);
    return result.lastSyncTime || null;
}

// Save last sync time
async function saveLastSyncTime(time) {
    await chrome.storage.local.set({ lastSyncTime: time });
}

// Get pending history items
async function getPendingHistory() {
    const result = await chrome.storage.local.get(['pendingHistory']);
    return result.pendingHistory || [];
}

// Save pending history items
async function savePendingHistory(items) {
    await chrome.storage.local.set({ pendingHistory: items });
}

// Clear pending history
async function clearPendingHistory() {
    await chrome.storage.local.remove(['pendingHistory']);
}

// Capture new history items
chrome.history.onVisited.addListener(async (historyItem) => {
    console.log('New history item:', historyItem);
    
    const config = await loadConfig();
    if (!config.enableSync) {
        return;
    }
    
    // Add device info to history item
    const deviceInfo = getDeviceInfo();
    const enrichedItem = {
        ...historyItem,
        deviceInfo: deviceInfo,
        capturedAt: new Date().toISOString()
    };
    
    // Add to pending items
    const pending = await getPendingHistory();
    pending.push(enrichedItem);
    await savePendingHistory(pending);
    
    // Update badge to show pending count
    chrome.action.setBadgeText({ text: pending.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
});

// Sync history to Pantry
async function syncToPantry() {
    console.log('Starting sync to Pantry...');
    
    const config = await loadConfig();
    if (!config.enableSync || !config.pantryId) {
        console.log('Sync disabled or no Pantry ID configured');
        return { success: false, error: 'Sync disabled or not configured' };
    }
    
    const pending = await getPendingHistory();
    if (pending.length === 0) {
        console.log('No pending items to sync');
        return { success: true, syncedCount: 0 };
    }
    
    try {
        // Generate encryption key from Pantry ID
        const key = await generateKey(config.pantryId);
        
        // Get existing history from Pantry
        const response = await fetch(`https://getpantry.cloud/apiv1/pantry/${config.pantryId}/basket/${config.basketName}`);
        let existingData = { items: [] };
        
        if (response.ok) {
            const encrypted = await response.text();
            if (encrypted && encrypted !== '{}') {
                const decrypted = await decryptData(encrypted, key);
                if (decrypted) {
                    existingData = decrypted;
                }
            }
        }
        
        // Merge new items
        existingData.items = existingData.items || [];
        existingData.items.push(...pending);
        existingData.lastSync = new Date().toISOString();
        existingData.syncDevice = getDeviceInfo();
        
        // Encrypt and upload
        const encrypted = await encryptData(existingData, key);
        
        const uploadResponse = await fetch(`https://getpantry.cloud/apiv1/pantry/${config.pantryId}/basket/${config.basketName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: encrypted
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
        
        // Clear pending items and update last sync
        await clearPendingHistory();
        await saveLastSyncTime(new Date().toISOString());
        
        // Clear badge
        chrome.action.setBadgeText({ text: '' });
        
        console.log(`Successfully synced ${pending.length} items`);
        return { success: true, syncedCount: pending.length };
        
    } catch (error) {
        console.error('Sync error:', error);
        return { success: false, error: error.message };
    }
}

// Search history from Pantry
async function searchFromPantry(query, searchType = 'all') {
    const config = await loadConfig();
    if (!config.pantryId) {
        return { success: false, error: 'No Pantry ID configured' };
    }
    
    try {
        // Generate encryption key
        const key = await generateKey(config.pantryId);
        
        // Fetch from Pantry
        const response = await fetch(`https://getpantry.cloud/apiv1/pantry/${config.pantryId}/basket/${config.basketName}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                return { success: true, results: [] };
            }
            throw new Error(`Fetch failed: ${response.status}`);
        }
        
        const encrypted = await response.text();
        if (!encrypted || encrypted === '{}') {
            return { success: true, results: [] };
        }
        
        const decrypted = await decryptData(encrypted, key);
        if (!decrypted || !decrypted.items) {
            return { success: true, results: [] };
        }
        
        // Filter results based on search
        let results = decrypted.items;
        
        if (query) {
            const lowerQuery = query.toLowerCase();
            results = results.filter(item => {
                switch (searchType) {
                    case 'title':
                        return item.title && item.title.toLowerCase().includes(lowerQuery);
                    case 'url':
                        return item.url && item.url.toLowerCase().includes(lowerQuery);
                    default: // 'all'
                        return (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
                               (item.url && item.url.toLowerCase().includes(lowerQuery));
                }
            });
        }
        
        // Sort by visit time (most recent first)
        results.sort((a, b) => {
            const timeA = a.lastVisitTime || 0;
            const timeB = b.lastVisitTime || 0;
            return timeB - timeA;
        });
        
        // Limit results
        results = results.slice(0, 100);
        
        return { success: true, results };
        
    } catch (error) {
        console.error('Search error:', error);
        return { success: false, error: error.message };
    }
}

// Set up sync alarm
async function setupSyncAlarm() {
    const config = await loadConfig();
    
    // Clear existing alarm
    await chrome.alarms.clear('syncHistory');
    
    if (config.enableSync && config.syncInterval > 0) {
        // Create new alarm
        chrome.alarms.create('syncHistory', {
            periodInMinutes: config.syncInterval / 60
        });
        console.log(`Sync alarm set for every ${config.syncInterval / 60} minutes`);
    }
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncHistory') {
        syncToPantry();
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'forceSync') {
        syncToPantry().then(sendResponse);
        return true; // Will respond asynchronously
    } else if (request.action === 'search') {
        searchFromPantry(request.query, request.searchType).then(sendResponse);
        return true; // Will respond asynchronously
    } else if (request.action === 'updateConfig') {
        saveConfig(request.config).then(() => {
            setupSyncAlarm();
            sendResponse({ success: true });
        });
        return true; // Will respond asynchronously
    } else if (request.action === 'getStatus') {
        Promise.all([
            loadConfig(),
            getLastSyncTime(),
            getPendingHistory()
        ]).then(([config, lastSync, pending]) => {
            sendResponse({
                config,
                lastSync,
                pendingCount: pending.length
            });
        });
        return true; // Will respond asynchronously
    }
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
    console.log('bar123 Chrome Extension installed');
    setupSyncAlarm();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('bar123 Chrome Extension started');
    setupSyncAlarm();
});