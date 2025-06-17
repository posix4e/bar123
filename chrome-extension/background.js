// Chrome Extension Background Service Worker
// Handles history tracking and sync with Pantry

console.log('bar123 background script loading...');

const PANTRY_BASE_URL = 'https://getpantry.cloud/apiv1/pantry';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Log when service worker starts
console.log('bar123 service worker started');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('bar123 Chrome Extension installed');
  
  // Set default storage values
  chrome.storage.local.get(['pantryId', 'basketName'], (result) => {
    if (!result.pantryId) {
      chrome.storage.local.set({
        pantryId: '',
        basketName: 'browser-history',
        lastSync: null,
        syncEnabled: false
      });
    }
  });
  
  // Start monitoring history
  startHistoryMonitoring();
  
  // Schedule periodic sync
  chrome.alarms.create('syncHistory', { periodInMinutes: 5 });
});

// Monitor history changes
function startHistoryMonitoring() {
  // Listen for new history entries
  chrome.history.onVisited.addListener((historyItem) => {
    console.log('New history item:', historyItem);
    saveHistoryItem(historyItem);
  });
  
  // Listen for tab updates to capture title changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      // Update title if we have it
      chrome.history.search({ text: tab.url, maxResults: 1 }, (results) => {
        if (results.length > 0) {
          const item = results[0];
          saveHistoryItem({
            id: item.id,
            url: tab.url,
            title: tab.title || item.title,
            lastVisitTime: item.lastVisitTime,
            visitCount: item.visitCount
          });
        }
      });
    }
  });
}

// Save history item to local storage
async function saveHistoryItem(historyItem) {
  const { url, title, lastVisitTime, visitCount } = historyItem;
  
  // Skip empty URLs or chrome:// URLs
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }
  
  const historyEntry = {
    id: crypto.randomUUID(),
    url: url,
    title: title || url,
    timestamp: lastVisitTime || Date.now(),
    visitCount: visitCount || 1,
    syncedToPantry: false,
    deviceId: await getDeviceId()
  };
  
  // Get existing history
  const { historyItems = [] } = await chrome.storage.local.get('historyItems');
  
  // Check if URL already exists
  const existingIndex = historyItems.findIndex(item => item.url === url);
  if (existingIndex !== -1) {
    // Update existing entry
    historyItems[existingIndex] = {
      ...historyItems[existingIndex],
      title: title || historyItems[existingIndex].title,
      visitCount: (historyItems[existingIndex].visitCount || 0) + 1,
      timestamp: lastVisitTime || Date.now(),
      syncedToPantry: false
    };
  } else {
    // Add new entry
    historyItems.push(historyEntry);
  }
  
  // Keep only last 1000 items
  if (historyItems.length > 1000) {
    historyItems.splice(0, historyItems.length - 1000);
  }
  
  // Save back to storage
  await chrome.storage.local.set({ historyItems });
  
  // Update badge
  updateBadge();
}

// Get or generate device ID
async function getDeviceId() {
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (deviceId) {
    return deviceId;
  }
  
  const newDeviceId = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: newDeviceId });
  return newDeviceId;
}

// Update extension badge with unsynced count
async function updateBadge() {
  const { historyItems = [] } = await chrome.storage.local.get('historyItems');
  const unsyncedCount = historyItems.filter(item => !item.syncedToPantry).length;
  
  if (unsyncedCount > 0) {
    chrome.action.setBadgeText({ text: unsyncedCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Sync with Pantry
async function syncWithPantry() {
  const { pantryId, basketName, syncEnabled } = await chrome.storage.local.get(['pantryId', 'basketName', 'syncEnabled']);
  
  if (!syncEnabled || !pantryId) {
    console.log('Sync disabled or not configured');
    return;
  }
  
  try {
    // Get unsynced items
    const { historyItems = [] } = await chrome.storage.local.get('historyItems');
    const unsyncedItems = historyItems.filter(item => !item.syncedToPantry);
    
    if (unsyncedItems.length === 0) {
      console.log('No items to sync');
      return;
    }
    
    console.log(`Syncing ${unsyncedItems.length} items to Pantry`);
    
    // Get existing basket data
    const basketUrl = `${PANTRY_BASE_URL}/${pantryId}/basket/${basketName}`;
    let existingData = { items: [] };
    
    try {
      const response = await fetch(basketUrl);
      if (response.ok) {
        existingData = await response.json();
      }
    } catch (error) {
      console.log('No existing basket data');
    }
    
    // Merge new items
    const allItems = [...(existingData.items || []), ...unsyncedItems];
    
    // Remove duplicates based on URL and keep most recent
    const uniqueItems = allItems.reduce((acc, item) => {
      const existing = acc.find(i => i.url === item.url);
      if (!existing || item.timestamp > existing.timestamp) {
        return [...acc.filter(i => i.url !== item.url), item];
      }
      return acc;
    }, []);
    
    // Sort by timestamp descending
    uniqueItems.sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only last 500 items
    const itemsToSync = uniqueItems.slice(0, 500);
    
    // Update basket
    const updateResponse = await fetch(basketUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: itemsToSync,
        lastSync: new Date().toISOString(),
        deviceId: await getDeviceId()
      })
    });
    
    if (updateResponse.ok) {
      // Mark items as synced
      const updatedHistoryItems = historyItems.map(item => {
        if (unsyncedItems.find(u => u.id === item.id)) {
          return { ...item, syncedToPantry: true };
        }
        return item;
      });
      
      await chrome.storage.local.set({ 
        historyItems: updatedHistoryItems,
        lastSync: new Date().toISOString()
      });
      
      console.log('Sync completed successfully');
      updateBadge();
    } else {
      throw new Error(`Sync failed: ${updateResponse.status}`);
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncHistory') {
    syncWithPantry();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'getStats') {
    chrome.storage.local.get(['historyItems', 'lastSync', 'syncEnabled'], (result) => {
      console.log('Storage data for stats:', result);
      const unsyncedCount = (result.historyItems || []).filter(item => !item.syncedToPantry).length;
      const response = {
        totalItems: (result.historyItems || []).length,
        unsyncedCount: unsyncedCount,
        lastSync: result.lastSync,
        syncEnabled: result.syncEnabled
      };
      console.log('Sending stats response:', response);
      sendResponse(response);
    });
    return true;
  } else if (request.action === 'syncNow') {
    syncWithPantry().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (request.action === 'updateSettings') {
    chrome.storage.local.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initial sync on startup
chrome.runtime.onStartup.addListener(() => {
  syncWithPantry();
});