// Content script for bar123 Chrome Extension
// This runs on every page to capture additional metadata if needed

console.log('bar123 content script loaded on:', window.location.href);

// Send page info to background script when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sendPageInfo);
} else {
  sendPageInfo();
}

function sendPageInfo() {
  // Get page metadata
  const pageInfo = {
    url: window.location.href,
    title: document.title,
    description: getMetaContent('description'),
    keywords: getMetaContent('keywords'),
    timestamp: Date.now()
  };
  
  console.log('bar123 sending page info:', pageInfo);
  
  // Only send if we have useful information
  if (pageInfo.url && !pageInfo.url.startsWith('chrome://')) {
    chrome.runtime.sendMessage({
      action: 'pageInfo',
      data: pageInfo
    }, (response) => {
      console.log('bar123 background response:', response);
    });
  }
}

function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"]`) || 
               document.querySelector(`meta[property="og:${name}"]`);
  return meta ? meta.content : '';
}

// Listen for title changes (for SPAs)
const titleObserver = new MutationObserver((mutations) => {
  sendPageInfo();
});

titleObserver.observe(document.querySelector('title'), {
  childList: true,
  subtree: true,
  characterData: true
});