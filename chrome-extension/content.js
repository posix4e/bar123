/**
 * content.js - Chrome Extension Content Script
 * Tracks page visits and reports them to the background script
 *
 * Note: Chrome's history API already tracks visits automatically,
 * so this content script is minimal and mainly serves as a placeholder
 * for potential future enhancements like capturing additional metadata
 */

// Only track if the page has finished loading
if (document.readyState === 'complete') {
    trackPageVisit();
} else {
    window.addEventListener('load', trackPageVisit);
}

function trackPageVisit() {
    // Skip certain URLs
    const url = window.location.href;
    if (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:')) {
        return;
    }

    // Chrome's history API automatically tracks visits,
    // but we could send additional metadata here if needed
    console.log('Page visit tracked:', {
        url: url,
        title: document.title,
        timestamp: new Date().toISOString()
    });
}