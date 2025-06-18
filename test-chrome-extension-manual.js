// Manual test script for Chrome extension
// Run this in the Chrome DevTools console on the extension popup page

async function testExtension() {
  console.log('=== Chrome Extension Manual Test ===');
  
  // Test 1: Check Chrome APIs
  console.log('\n1. Checking Chrome APIs...');
  console.log('✓ chrome:', typeof chrome !== 'undefined');
  console.log('✓ storage:', typeof chrome?.storage !== 'undefined');
  console.log('✓ history:', typeof chrome?.history !== 'undefined');
  console.log('✓ runtime:', typeof chrome?.runtime !== 'undefined');
  
  // Test 2: Get current storage
  console.log('\n2. Current storage data:');
  chrome.storage.local.get(null, (data) => {
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Test 3: Search history
  console.log('\n3. Recent history:');
  chrome.history.search({ text: '', maxResults: 5 }, (results) => {
    results.forEach(item => {
      console.log(`- ${item.title || 'No title'}: ${item.url}`);
    });
  });
  
  // Test 4: Test message to background
  console.log('\n4. Testing background communication...');
  chrome.runtime.sendMessage({ action: 'test' }, (response) => {
    console.log('Background response:', response);
  });
  
  // Test 5: Get stats
  console.log('\n5. Getting stats...');
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    console.log('Stats:', response);
  });
  
  // Test 6: Manual save test
  console.log('\n6. Testing manual save...');
  chrome.history.search({ text: '', maxResults: 1 }, (results) => {
    if (results.length > 0) {
      chrome.runtime.sendMessage({
        action: 'manualSave',
        historyItem: results[0]
      }, (response) => {
        console.log('Manual save response:', response);
        
        // Check updated stats
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
            console.log('Updated stats:', response);
          });
        }, 1000);
      });
    }
  });
}

// Instructions
console.log('Chrome Extension Manual Test Instructions:');
console.log('1. Open chrome://extensions/');
console.log('2. Enable Developer mode');
console.log('3. Load unpacked extension from chrome-extension directory');
console.log('4. Click on the extension icon to open popup');
console.log('5. Right-click popup and select "Inspect"');
console.log('6. Run: testExtension()');
console.log('\nOr copy and paste the entire script into the console.');