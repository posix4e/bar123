// Content script - runs on every page
// This is mainly used to ensure we capture accurate page titles

// Send page info to background script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendPageInfo);
} else {
    sendPageInfo();
}

function sendPageInfo() {
    // The history API in background.js will handle most of the work
    // This content script can be used for additional page analysis if needed
    
    // Example: capture additional metadata
    const pageInfo = {
        url: window.location.href,
        title: document.title,
        description: getMetaDescription(),
        timestamp: Date.now()
    };
    
    // You can send this to background script if needed for additional processing
    // browser.runtime.sendMessage({ action: 'pageInfo', data: pageInfo });
}

function getMetaDescription() {
    const metaDesc = document.querySelector('meta[name="description"]');
    return metaDesc ? metaDesc.getAttribute('content') : '';
}