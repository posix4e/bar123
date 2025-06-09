/**
 * popup-minimal.js - Minimal popup script for Safari Extension
 * Only displays last 10 sent items and forwards actions to native
 */

// Get DOM elements
const historyList = document.getElementById('historyList');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const settingsButton = document.getElementById('settingsButton');
const connectionStatus = document.getElementById('connectionStatus');

// Load and display recent history on popup open
document.addEventListener('DOMContentLoaded', async () => {
    await loadRecentHistory();
    await updateConnectionStatus();
});

// Load recent history from background script cache
async function loadRecentHistory() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'get_recent_history' });
        if (response.success) {
            displayHistory(response.history);
        }
    } catch (error) {
        console.error('Failed to load history:', error);
        historyList.innerHTML = '<p class="empty-state">Failed to load history</p>';
    }
}

// Display history items
function displayHistory(items) {
    if (items.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No recent history</p>';
        return;
    }
    
    historyList.innerHTML = items.map(item => {
        const date = new Date(item.visitDate);
        const timeString = date.toLocaleTimeString();
        
        return `
            <div class="history-item" data-url="${item.url}">
                <div class="history-title">${item.title}</div>
                <div class="history-url">${item.url}</div>
                <div class="history-meta">${timeString}</div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            browser.tabs.create({ url: item.dataset.url });
        });
    });
}

// Update connection status from native
async function updateConnectionStatus() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'get_connection_status' });
        if (response.success && response.connected) {
            connectionStatus.classList.add('connected');
            connectionStatus.querySelector('.status-text').textContent = 'Connected';
        } else {
            connectionStatus.classList.remove('connected');
            connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
        }
    } catch (error) {
        console.error('Failed to get connection status:', error);
    }
}

// Search - forward to native
searchButton.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    
    try {
        const response = await browser.runtime.sendMessage({
            type: 'search',
            query: query
        });
        
        if (response.success && response.results) {
            displayHistory(response.results);
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
});

// Settings - open native settings
settingsButton.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'open_settings' });
});

// Enter key for search
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchButton.click();
    }
});