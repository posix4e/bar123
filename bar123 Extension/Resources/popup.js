console.log("🔥 BAR123 POPUP: Loading history");

// Load history from storage
function loadHistory() {
    // Get history from local storage
    browser.storage.local.get(['browsing_history']).then((result) => {
        const history = result.browsing_history || [];
        displayHistory(history);
    }).catch((error) => {
        console.log("🔥 BAR123 POPUP: Error loading history:", error);
        displayHistory([]);
    });
}

function displayHistory(history) {
    const historyList = document.getElementById('history-list');
    
    if (!history || history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No browsing history yet.<br>Browse some websites!</div>';
        return;
    }
    
    // Show last 10 items, newest first
    const recentHistory = history.slice(-10).reverse();
    
    historyList.innerHTML = recentHistory.map(item => `
        <div class="history-item">
            <div class="title">${escapeHtml(item.title || 'No title')}</div>
            <div class="url">${escapeHtml(item.url || '')}</div>
            <div class="time">${formatTime(item.timestamp)}</div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

// Store history item
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
            console.log("🔥 BAR123 POPUP: History stored");
            loadHistory(); // Refresh display
        });
    });
}

// Listen for history updates from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'pageVisit') {
        storeHistoryItem(message.url, message.title, message.timestamp);
    }
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadHistory();
    });
    
    document.getElementById('sync-btn').addEventListener('click', () => {
        // Toggle P2P sync
        console.log("🔥 BAR123 POPUP: P2P sync toggle requested");
        toggleP2PSync();
    });
    
    document.getElementById('open-app-btn').addEventListener('click', () => {
        // This would open the main app if possible
        console.log("🔥 BAR123 POPUP: Open app requested");
    });
});

// P2P functionality for popup
let popupP2PSync = null;

function toggleP2PSync() {
    if (popupP2PSync && popupP2PSync.isActive()) {
        popupP2PSync.stop();
        updateSyncStatus(false, 0);
    } else {
        startPopupP2PSync();
    }
}

function startPopupP2PSync() {
    browser.storage.local.get(['p2p_settings']).then((result) => {
        const settings = result.p2p_settings;
        if (!settings || !settings.sharedSecret) {
            console.log("🔥 BAR123 POPUP: No P2P settings found");
            return;
        }
        
        if (popupP2PSync) {
            popupP2PSync.stop();
        }
        
        // Create simplified P2P sync for popup
        popupP2PSync = new PopupP2PSync();
        popupP2PSync.start(settings);
    });
}

function updateSyncStatus(active, peerCount) {
    const syncText = document.getElementById('sync-text');
    const peerCountEl = document.getElementById('peer-count');
    
    if (syncText) {
        syncText.textContent = active ? 'P2P: On' : 'P2P: Off';
    }
    if (peerCountEl) {
        peerCountEl.textContent = `Peers: ${peerCount}`;
    }
}

class PopupP2PSync {
    constructor() {
        this.active = false;
        this.peers = 0;
    }
    
    isActive() {
        return this.active;
    }
    
    start(settings) {
        this.active = true;
        console.log("🔥 BAR123 POPUP: Starting P2P sync with settings:", settings);
        updateSyncStatus(true, 0);
        
        // Simulate connection for demo
        setTimeout(() => {
            this.peers = Math.floor(Math.random() * 3) + 1;
            updateSyncStatus(true, this.peers);
        }, 2000);
    }
    
    stop() {
        this.active = false;
        this.peers = 0;
        updateSyncStatus(false, 0);
        console.log("🔥 BAR123 POPUP: P2P sync stopped");
    }
}

// Load initial sync status
document.addEventListener('DOMContentLoaded', () => {
    updateSyncStatus(false, 0);
});

console.log("🔥 BAR123 POPUP: Script loaded");
