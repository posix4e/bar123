<<<<<<< HEAD
browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});
=======
class HistoryTracker {
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

    trackPageVisit() {
        const historyEntry = {
            url: window.location.href,
            title: document.title,
            visitTime: Date.now(),
            duration: 0,
            hostname: window.location.hostname,
            pathname: window.location.pathname
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
>>>>>>> 6a3c53c (Initial Commit)
