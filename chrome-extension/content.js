// Chrome extension content script for history tracking only
console.log('History Sync content script loaded');

// Track page visits
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', trackPageVisit);
} else {
  trackPageVisit();
}

function trackPageVisit() {
  const historyEntry = {
    url: window.location.href,
    title: document.title,
    visitTime: Date.now()
  };
    
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'trackHistory',
    entry: historyEntry
  }).catch(error => {
    console.log('Failed to track history:', error);
  });
}