// Content script to capture additional page metadata if needed
window.addEventListener('load', () => {
  const pageData = {
    url: window.location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    timestamp: Date.now()
  };
  
  // Send to background script
  browser.runtime.sendMessage({
    action: "pageLoaded",
    data: pageData
  });
});