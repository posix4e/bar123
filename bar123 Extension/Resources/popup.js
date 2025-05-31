class HistoryDisplayUI {
  constructor() {
    this.initializeElements();
    this.loadRecentHistory();
  }

  initializeElements() {
    this.syncStatus = document.getElementById('syncStatus');
    this.pageCount = document.getElementById('pageCount');
    this.historyList = document.getElementById('historyList');
  }

  async loadRecentHistory() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getRecentHistory', limit: 10 });
      if (response && response.success) {
        this.displayHistory(response.history || []);
        this.updateStatus(response.history?.length || 0);
      } else {
        this.displayEmptyState();
      }
    } catch (error) {
      console.error('Failed to load recent history:', error);
      this.displayEmptyState();
    }
  }

  updateStatus(count) {
    this.pageCount.textContent = `${count} pages tracked`;
  }

  displayHistory(historyEntries) {
    if (!historyEntries || historyEntries.length === 0) {
      this.displayEmptyState();
      return;
    }

    // Sort by visit time (newest first)
    const sortedHistory = historyEntries.sort((a, b) => (b.visitTime || 0) - (a.visitTime || 0));

    // Take only the last 10 entries
    const recentHistory = sortedHistory.slice(0, 10);

    const historyHTML = recentHistory.map(entry => {
      const visitTime = new Date(entry.visitTime || 0);
      const timeAgo = this.getTimeAgo(visitTime);
            
      // Article content display
      const articleContent = entry.articleContent;
      let articleInfo = '';
      let summaryInfo = '';
      
      if (articleContent && articleContent.isArticle) {
        const readingTime = articleContent.readingTime;
        const excerpt = articleContent.excerpt ? this.truncateText(articleContent.excerpt, 120) : '';
        articleInfo = `<span class="article-badge">📖 Article • ${readingTime} min read</span>`;
        if (excerpt) {
          summaryInfo = `<div class="article-excerpt">${excerpt}</div>`;
        }
      }
            
      return `
        <div class="history-entry">
          <div class="history-title" title="${entry.title || ''}">${entry.title || 'Untitled'}</div>
          <div class="history-url" title="${entry.url || ''}">${this.truncateUrl(entry.url || '')}</div>
          ${articleInfo ? `<div class="article-info">${articleInfo}</div>` : ''}
          ${summaryInfo}
          <div class="history-meta">
            <span>${timeAgo}</span>
          </div>
        </div>
      `;
    }).join('');

    this.historyList.innerHTML = historyHTML;
  }

  displayEmptyState() {
    this.historyList.innerHTML = '<div class="empty-state">No recent pages tracked yet. Browse some websites to see them here.</div>';
    this.updateStatus(0);
  }

  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname;
            
      if (path === '/' || path === '') {
        return domain;
      }
            
      const maxLength = 40;
      const full = domain + path;
      return full.length > maxLength ? full.substring(0, maxLength) + '...' : full;
    } catch {
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
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
}

// Listen for history updates from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'historyUpdated') {
    const ui = window.historyDisplayUI;
    if (ui) {
      ui.loadRecentHistory();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  window.historyDisplayUI = new HistoryDisplayUI();
});