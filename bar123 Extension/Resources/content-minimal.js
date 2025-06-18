/**
 * content-minimal.js - Minimal content script for Safari Extension
 * Only captures page visits and sends to background script
 */

// Only track when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageVisit);
} else {
    trackPageVisit();
}

function trackPageVisit() {
    // Only send essential data to background
    browser.runtime.sendMessage({
        type: 'page_visit',
        url: window.location.href,
        title: document.title || 'Untitled',
        timestamp: Date.now()
    });
}