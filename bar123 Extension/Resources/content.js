// Track page visits
(function() {
    // Debounce timer to avoid duplicate entries
    let debounceTimer = null;
    
    function trackPageVisit() {
        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // Wait a bit to ensure page is fully loaded
        debounceTimer = setTimeout(() => {
            const pageData = {
                url: window.location.href,
                title: document.title || window.location.href,
                timestamp: Date.now()
            };
            
            // Send to background script
            browser.runtime.sendMessage({
                action: "pageVisited",
                data: pageData
            }).then((response) => {
                console.log("Page visit tracked:", response);
            }).catch((error) => {
                console.error("Error tracking page visit:", error);
            });
        }, 1000); // Wait 1 second after page load
    }
    
    // Track initial page load
    if (document.readyState === "complete") {
        trackPageVisit();
    } else {
        window.addEventListener("load", trackPageVisit);
    }
    
    // Track navigation within single-page apps
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            trackPageVisit();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Listen for messages from extension
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Content script received request:", request);
        
        if (request.action === "getPageInfo") {
            sendResponse({
                url: window.location.href,
                title: document.title,
                timestamp: Date.now()
            });
        }
    });
})();
