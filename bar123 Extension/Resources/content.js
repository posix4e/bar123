/**
 * content.js - Safari Extension Content Script
 * Tracks page visits and sends them to the background script
 */

// Track page visit when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Send page info to background script
    browser.runtime.sendMessage({
        type: 'page_visit',
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
    }).then((response) => {
        console.log('Page visit tracked:', response);
    }).catch((error) => {
        console.error('Error tracking page visit:', error);
    });
});

// Listen for messages from background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received request:', request);
    
    // Handle different message types if needed
    switch (request.type) {
        case 'get_page_info':
            sendResponse({
                url: window.location.href,
                title: document.title
            });
            break;
        default:
            sendResponse({ success: false, error: 'Unknown request type' });
    }
});
