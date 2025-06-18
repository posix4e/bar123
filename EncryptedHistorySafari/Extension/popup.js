document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    
    document.getElementById('refreshBtn').addEventListener('click', loadHistory);
    document.getElementById('syncBtn').addEventListener('click', syncHistory);
});

function loadHistory() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const historyList = document.getElementById('historyList');
    
    loading.style.display = 'block';
    error.style.display = 'none';
    historyList.style.display = 'none';
    
    browser.runtime.sendMessage({ action: 'getHistory' }, (response) => {
        loading.style.display = 'none';
        
        if (response && response.history) {
            displayHistory(response.history);
        } else {
            error.style.display = 'block';
            error.textContent = 'Failed to load history';
        }
    });
}

function displayHistory(history) {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    historyList.style.display = 'block';
    
    if (history.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No history found</div>';
        return;
    }
    
    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const title = document.createElement('div');
        title.className = 'history-title';
        title.textContent = item.title || 'Untitled';
        
        const url = document.createElement('div');
        url.className = 'history-url';
        url.textContent = item.url;
        
        const time = document.createElement('div');
        time.className = 'history-time';
        time.textContent = new Date(item.timestamp).toLocaleString();
        
        div.appendChild(title);
        div.appendChild(url);
        div.appendChild(time);
        
        div.addEventListener('click', () => {
            browser.tabs.create({ url: item.url });
        });
        
        historyList.appendChild(div);
    });
}

function syncHistory() {
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    
    browser.runtime.sendNativeMessage('com.encryptedhistory.safari', {
        action: 'sync'
    }, (response) => {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
        
        if (response && response.success) {
            loadHistory();
        } else {
            const error = document.getElementById('error');
            error.style.display = 'block';
            error.textContent = 'Sync failed';
        }
    });
}