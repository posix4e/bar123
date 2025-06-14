browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const historyEntry = {
      url: tab.url,
      title: tab.title || '',
      timestamp: Date.now(),
      tabId: tabId
    };
    
    browser.runtime.sendNativeMessage("com.encryptedhistory.safari", {
      action: "addHistory",
      data: historyEntry
    });
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getHistory") {
    browser.runtime.sendNativeMessage("com.encryptedhistory.safari", {
      action: "getHistory",
      filters: request.filters || {}
    }, (response) => {
      sendResponse(response);
    });
    return true;
  }
});