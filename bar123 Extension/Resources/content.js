xclass HistoryTracker {
  constructor() {
    this.lastUrl = window.location.href;
    this.startTime = Date.now();
    this.init();
  }

  init() {
    this.trackPageVisit();
    this.setupNavigationTracking();
        
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getPageInfo') {
        sendResponse({
          url: window.location.href,
          title: document.title,
          visitTime: Date.now()
        });
      }
    });
  }

  extractArticleContent() {
    try {
      // Clone the document for Readability
      const documentClone = document.cloneNode(true);
      const reader = new Readability(documentClone);
      const article = reader.parse();
      
      if (article) {
        console.log('📖 Extracted article content:', {
          title: article.title,
          contentLength: article.textContent?.length || 0,
          excerpt: article.excerpt
        });
        
        return {
          title: article.title,
          content: article.textContent,
          excerpt: article.excerpt,
          length: article.length,
          readingTime: Math.ceil((article.textContent?.split(' ').length || 0) / 200), // ~200 WPM
          isArticle: article.length > 500
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to extract article content:', error);
      return null;
    }
  }

  trackPageVisit() {
    const basicEntry = {
      url: window.location.href,
      title: document.title,
      visitTime: Date.now(),
      duration: 0,
      hostname: window.location.hostname,
      pathname: window.location.pathname
    };

    // Extract article content if possible
    const articleContent = this.extractArticleContent();
    
    const historyEntry = {
      ...basicEntry,
      articleContent: articleContent
    };

    console.log('🌐 Content script tracking page visit:', historyEntry);

    browser.runtime.sendMessage({
      action: 'trackHistory',
      entry: historyEntry
    }).then((response) => {
      console.log('✅ History tracking successful:', response);
    }).catch(err => {
      console.log('❌ History tracking failed:', err);
    });
  }

  setupNavigationTracking() {
    let observer;

    const trackNavigation = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        const duration = Date.now() - this.startTime;
                
        browser.runtime.sendMessage({
          action: 'updateDuration',
          url: this.lastUrl,
          duration: duration
        }).catch(err => {
          console.log('Duration update failed:', err);
        });

        this.lastUrl = currentUrl;
        this.startTime = Date.now();
        this.trackPageVisit();
      }
    };

    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        setTimeout(trackNavigation, 100);
      });
            
      observer.observe(document, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener('popstate', trackNavigation);
    window.addEventListener('pushstate', trackNavigation);
    window.addEventListener('replacestate', trackNavigation);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      window.dispatchEvent(new Event('pushstate'));
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      window.dispatchEvent(new Event('replacestate'));
    };

    window.addEventListener('beforeunload', () => {
      const duration = Date.now() - this.startTime;
      browser.runtime.sendMessage({
        action: 'updateDuration',
        url: this.lastUrl,
        duration: duration
      }).catch(() => {});
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new HistoryTracker();
  });
} else {
  new HistoryTracker();
}
