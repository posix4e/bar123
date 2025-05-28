document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const sharedSecretInput = document.getElementById('sharedSecret');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const historyList = document.getElementById('historyList');
    
  // Load initial state
  updateUI();
  showSearchPrompt();
    
  connectBtn.addEventListener('click', async () => {
    const secret = sharedSecretInput.value.trim();
    if (!secret) {
      alert('Please enter a shared secret');
      return;
    }
        
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
        
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'connect',
        sharedSecret: secret
      });
            
      if (response.success) {
        updateUI();
      } else {
        alert('Connection failed: ' + response.error);
      }
    } catch (error) {
      alert('Connection error: ' + error.message);
    }
        
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
  });
    
  disconnectBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'disconnect' });
    updateUI();
  });
    
  searchBtn.addEventListener('click', () => {
    searchHistory();
  });

  clearSearchBtn.addEventListener('click', () => {
    clearSearch();
  });

  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      searchHistory();
    }
  });
    
  async function updateUI() {
    try {
      const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
            
      if (stats.isConnected) {
        if (statusDiv) {
          statusDiv.className = 'status connected';
          statusDiv.textContent = `Connected (${stats.deviceCount} peers)`;
        }
        if (connectBtn) {connectBtn.style.display = 'none';}
        if (disconnectBtn) {disconnectBtn.style.display = 'inline-block';}
      } else {
        if (statusDiv) {
          statusDiv.className = 'status disconnected';
          statusDiv.textContent = 'Disconnected';
        }
        if (connectBtn) {connectBtn.style.display = 'inline-block';}
        if (disconnectBtn) {disconnectBtn.style.display = 'none';}
      }
    } catch (error) {
      console.error('Failed to update UI:', error);
    }
  }
    
  function showSearchPrompt() {
    if (historyList) {
      historyList.innerHTML = '<div class="search-prompt">Enter search terms to find articles</div>';
    }
  }

  function getSearchableText(entry) {
    const parts = [
      entry.title || '',
      entry.url || '',
      entry.articleContent?.title || '',
      entry.articleContent?.content || '',
      entry.articleContent?.excerpt || ''
    ];
    return parts.join(' ').toLowerCase();
  }

  function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  function truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      return url.length > 35 ? domain + '...' : url;
    } catch {
      return url.length > 35 ? url.substring(0, 35) + '...' : url;
    }
  }

  function getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
        
    if (seconds < 60) {return `${seconds}s ago`;}
    if (seconds < 3600) {return `${Math.floor(seconds / 60)}m ago`;}
    if (seconds < 86400) {return `${Math.floor(seconds / 3600)}h ago`;}
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function displayHistory(historyEntries) {
    if (!historyEntries || historyEntries.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No history entries yet</div>';
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
      const timeAgo = getTimeAgo(visitTime);
            
      const duration = entry.duration ? `${Math.round(entry.duration / 1000)}s` : '';
      const source = isLocal ? 'Local' : 'Synced';

      // Article content display
      const articleContent = entry.articleContent;
      let articleInfo = '';
      if (articleContent && articleContent.isArticle) {
        const readingTime = articleContent.readingTime;
        const excerpt = articleContent.excerpt ? truncateText(articleContent.excerpt, 100) : '';
        articleInfo = `
          <div class="article-info">
            <span class="article-badge">📖 Article • ${readingTime} min read</span>
            ${excerpt ? `<div class="article-excerpt">${excerpt}</div>` : ''}
          </div>
        `;
      }
            
      return `
        <div class="history-entry ${entryClass}" data-search-content="${getSearchableText(entry)}">
          <div class="history-title" title="${entry.title || ''}">${entry.title || 'Untitled'}</div>
          <div class="history-url" title="${entry.url || ''}">${truncateUrl(entry.url || '')}</div>
          ${articleInfo}
          <div class="history-meta">
            <span>${source}</span> • <span>${timeAgo} ${duration ? `• ${duration}` : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    historyList.innerHTML = historyHTML;
  }

  async function searchHistory() {
    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) {
      showSearchPrompt();
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getHistory' 
      });
      
      if (response.success && response.history) {
        // Filter history based on search query
        const filteredHistory = response.history.filter(entry => {
          const searchText = getSearchableText(entry);
          return searchText.includes(query);
        });
        
        displayHistory(filteredHistory);
        
        // Update UI to show search results
        const resultCount = filteredHistory.length;
        if (resultCount === 0) {
          historyList.innerHTML = `<div class="empty-state">No results found for "${query}"</div>`;
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      historyList.innerHTML = '<div class="empty-state">Search failed</div>';
    }
  }

  function clearSearch() {
    searchInput.value = '';
    showSearchPrompt();
  }
});