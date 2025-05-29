
class HistorySyncUI {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.updateUI();
  }

  initializeElements() {
    this.sharedSecretInput = document.getElementById('sharedSecret');
    this.connectBtn = document.getElementById('connectBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.clearLocalBtn = document.getElementById('clearLocalBtn');
    this.deleteRemoteBtn = document.getElementById('deleteRemoteBtn');
    this.debugSyncBtn = document.getElementById('debugSyncBtn');
    this.searchInput = document.getElementById('searchInput');
    this.searchBtn = document.getElementById('searchBtn');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.syncStatus = document.getElementById('syncStatus');
    this.deviceCount = document.getElementById('deviceCount');
    this.localCount = document.getElementById('localCount');
    this.lastSync = document.getElementById('lastSync');
    this.historyList = document.getElementById('historyList');
  }

  bindEvents() {
    this.connectBtn.addEventListener('click', () => this.connect());
    this.disconnectBtn.addEventListener('click', () => this.disconnect());
    this.clearLocalBtn.addEventListener('click', () => this.clearLocalHistory());
    this.deleteRemoteBtn.addEventListener('click', () => this.deleteRemoteHistory());
    this.debugSyncBtn.addEventListener('click', () => this.debugSync());
    this.searchBtn.addEventListener('click', () => this.searchHistory());
    this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
        
    this.sharedSecretInput.addEventListener('input', () => this.saveSettings());
    this.searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        this.searchHistory();
      }
    });
  }

  async loadSettings() {
    const settings = await browser.storage.local.get([
      'sharedSecret',
      'isConnected',
      'deviceCount',
      'localHistoryCount',
      'lastSyncTime'
    ]);

    this.sharedSecretInput.value = settings.sharedSecret || '';
        
    this.updateStatus(settings.isConnected, settings.deviceCount || 0);
    this.localCount.textContent = settings.localHistoryCount || 0;
    this.lastSync.textContent = settings.lastSyncTime ? 
      new Date(settings.lastSyncTime).toLocaleString() : 'Never';
        
    // Start with search prompt instead of loading all history
    this.showSearchPrompt();
  }

  async saveSettings() {
    const secret = this.sharedSecretInput.value;
    
    // Save to browser storage
    await browser.storage.local.set({
      sharedSecret: secret
    });
    
    // Also save to App Group storage for iOS app access
    try {
      const response = await browser.runtime.sendNativeMessage({
        type: 'saveSharedSecret',
        secret: secret
      });
      
      if (response && response.success) {
        console.log('Successfully saved shared secret to App Group storage');
      } else {
        console.warn('Failed to save shared secret to App Group storage:', response);
      }
    } catch (error) {
      console.warn('Native messaging not available or failed:', error);
    }
  }

  async connect() {
    const secret = this.sharedSecretInput.value.trim();

    if (!secret) {
      alert('Please enter a room secret');
      return;
    }

    this.connectBtn.disabled = true;
    this.connectBtn.textContent = 'Connecting...';

    try {
      await browser.runtime.sendMessage({
        action: 'connect',
        sharedSecret: secret
      });
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Connection failed: ' + error.message);
    } finally {
      this.connectBtn.disabled = false;
      this.connectBtn.textContent = 'Connect';
    }
  }

  async disconnect() {
    await browser.runtime.sendMessage({ action: 'disconnect' });
  }

  async clearLocalHistory() {
    if (confirm('Are you sure you want to clear all local history? This cannot be undone.')) {
      await browser.runtime.sendMessage({ action: 'clearLocal' });
      this.updateUI();
      this.showSearchPrompt();
    }
  }

  async deleteRemoteHistory() {
    if (confirm('Are you sure you want to delete all remote history for this secret? This will affect all devices using this secret.')) {
      await browser.runtime.sendMessage({ action: 'deleteRemote' });
      this.showSearchPrompt();
    }
  }

  async debugSync() {
    console.log('🔧 Triggering debug sync...');
    try {
      const response = await browser.runtime.sendMessage({ action: 'debugSync' });
      console.log('Debug sync response:', response);
      alert(`Force sync triggered. Found ${response.peerCount} peers. Check console for details.`);
    } catch (error) {
      console.error('Debug sync failed:', error);
      alert('Debug sync failed: ' + error.message);
    }
  }

  updateStatus(isConnected, deviceCount = 0) {
    this.syncStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
    this.syncStatus.className = `sync-status ${isConnected ? 'connected' : 'disconnected'}`;
    this.deviceCount.textContent = `${deviceCount} device${deviceCount !== 1 ? 's' : ''}`;
        
    this.connectBtn.style.display = isConnected ? 'none' : 'block';
    this.disconnectBtn.style.display = isConnected ? 'block' : 'none';
  }

  // Trystero handles P2P connections via multiple strategies

  async updateUI() {
    const stats = await browser.runtime.sendMessage({ action: 'getStats' });
    if (stats) {
      this.updateStatus(stats.isConnected, stats.deviceCount);
      this.localCount.textContent = stats.localHistoryCount;
      this.lastSync.textContent = stats.lastSyncTime ? 
        new Date(stats.lastSyncTime).toLocaleString() : 'Never';
    }
    // Refresh history display
    this.loadHistory();
  }

  async loadHistory() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getHistory' });
      if (response && response.success) {
        this.displayHistory(response.history || []);
      } else {
        this.displayHistory([]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      this.displayHistory([]);
    }
  }

  displayHistory(historyEntries) {
    if (!historyEntries || historyEntries.length === 0) {
      this.historyList.innerHTML = '<div class="empty-state">No history entries yet</div>';
      return;
    }

    // Sort by visit time (newest first)
    const sortedHistory = historyEntries.sort((a, b) => (b.visitTime || 0) - (a.visitTime || 0));

    // Limit to last 20 entries for performance
    const recentHistory = sortedHistory.slice(0, 20);

    const historyHTML = recentHistory.map(entry => {
      const isLocal = !entry.synced || entry.sourceDevice === entry.deviceId;
      const entryClass = isLocal ? 'local' : 'synced';
            
      const visitTime = new Date(entry.visitTime || 0);
      const timeAgo = this.getTimeAgo(visitTime);
            
      const duration = entry.duration ? `${Math.round(entry.duration / 1000)}s` : '';
      const source = isLocal ? 'Local' : 'Synced';

      // Article content display
      const articleContent = entry.articleContent;
      let articleInfo = '';
      if (articleContent && articleContent.isArticle) {
        const readingTime = articleContent.readingTime;
        const excerpt = articleContent.excerpt ? this.truncateText(articleContent.excerpt, 100) : '';
        articleInfo = `
          <div class="article-info">
            <span class="article-badge">📖 Article • ${readingTime} min read</span>
            ${excerpt ? `<div class="article-excerpt">${excerpt}</div>` : ''}
          </div>
        `;
      }
            
      return `
                <div class="history-entry ${entryClass}" data-search-content="${this.getSearchableText(entry)}">
                    <div class="history-url" title="${entry.url || ''}">${this.truncateUrl(entry.url || '')}</div>
                    <div class="history-title" title="${entry.title || ''}">${entry.title || 'Untitled'}</div>
                    ${articleInfo}
                    <div class="history-meta">
                        <span class="history-source ${entryClass}">${source}</span>
                        <span>${timeAgo} ${duration ? `• ${duration}` : ''}</span>
                    </div>
                </div>
            `;
    }).join('');

    this.historyList.innerHTML = historyHTML;
  }

  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname;
            
      if (path === '/' || path === '') {
        return domain;
      }
            
      const maxLength = 35;
      const full = domain + path;
      return full.length > maxLength ? full.substring(0, maxLength) + '...' : full;
    } catch {
      return url.length > 35 ? url.substring(0, 35) + '...' : url;
    }
  }

  getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
        
    if (seconds < 60) {return `${seconds}s ago`;}
    if (seconds < 3600) {return `${Math.floor(seconds / 60)}m ago`;}
    if (seconds < 86400) {return `${Math.floor(seconds / 3600)}h ago`;}
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  getSearchableText(entry) {
    const parts = [
      entry.title || '',
      entry.url || '',
      entry.articleContent?.title || '',
      entry.articleContent?.content || '',
      entry.articleContent?.excerpt || ''
    ];
    return parts.join(' ').toLowerCase();
  }

  async searchHistory() {
    const query = this.searchInput.value.trim().toLowerCase();
    
    if (!query) {
      this.showSearchPrompt();
      return;
    }

    try {
      const response = await browser.runtime.sendMessage({ 
        action: 'getHistory' 
      });
      
      if (response && response.history) {
        // Filter history based on search query
        const filteredHistory = response.history.filter(entry => {
          const searchText = this.getSearchableText(entry);
          return searchText.includes(query);
        });
        
        this.displayHistory(filteredHistory);
        
        // Update UI to show search results
        const resultCount = filteredHistory.length;
        if (resultCount === 0) {
          this.historyList.innerHTML = `<div class="empty-state">No results found for "${query}"</div>`;
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      this.historyList.innerHTML = '<div class="empty-state">Search failed</div>';
    }
  }

  clearSearch() {
    this.searchInput.value = '';
    this.showSearchPrompt();
  }

  showSearchPrompt() {
    this.historyList.innerHTML = '<div class="search-prompt">Enter search terms to find articles</div>';
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'statusUpdate') {
    const ui = window.historySyncUI;
    if (ui) {
      ui.updateStatus(message.isConnected, message.deviceCount);
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  window.historySyncUI = new HistorySyncUI();
});
