document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const sharedSecretInput = document.getElementById('sharedSecret');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const refreshBtn = document.getElementById('refreshBtn');
    
  // Load initial state
  updateUI();
  loadHistory();
    
  connectBtn.addEventListener('click', async () => {
    const secret = sharedSecretInput.value.trim();
    if (!secret) {
      alert('Please enter a shared secret');
      return;
    }
        
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
        
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'connect',
        sharedSecret: secret
      });
            
      if (response.success) {
        updateUI();
      } else {
        alert('Connection failed: ' + response.error);
      }
    } catch (error) {
      alert('Connection error: ' + error.message);
    }
        
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
  });
    
  disconnectBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'disconnect' });
    updateUI();
  });
    
  refreshBtn.addEventListener('click', () => {
    loadHistory();
  });
    
  async function updateUI() {
    try {
      const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
            
      if (stats.isConnected) {
        if (statusDiv) {
          statusDiv.className = 'status connected';
          statusDiv.textContent = `Connected (${stats.deviceCount} peers)`;
        }
        if (connectBtn) {connectBtn.style.display = 'none';}
        if (disconnectBtn) {disconnectBtn.style.display = 'inline-block';}
      } else {
        if (statusDiv) {
          statusDiv.className = 'status disconnected';
          statusDiv.textContent = 'Disconnected';
        }
        if (connectBtn) {connectBtn.style.display = 'inline-block';}
        if (disconnectBtn) {disconnectBtn.style.display = 'none';}
      }
    } catch (error) {
      console.error('Failed to update UI:', error);
    }
  }
    
  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
            
      const historyList = document.getElementById('historyList');
      const noHistory = document.getElementById('noHistory');
      
      if (!historyList) {
        console.error('historyList element not found');
        return;
      }
            
      if (response.success && response.history && response.history.length > 0) {
        if (noHistory) {
          noHistory.style.display = 'none';
        }
        historyList.innerHTML = response.history.map(entry => {
          const date = new Date(entry.visitTime).toLocaleString();
          const sourceDevice = entry.sourceDevice ? ` (${entry.sourceDevice.split('_')[0]})` : '';
          return `
                        <div style="border-bottom: 1px solid #eee; padding: 4px 0;">
                            <div style="font-weight: bold; color: #007bff;">
                                ${entry.title || 'Untitled'}
                            </div>
                            <div style="color: #666; font-size: 10px;">
                                ${entry.url}
                            </div>
                            <div style="color: #999; font-size: 10px;">
                                ${date}${sourceDevice}
                            </div>
                        </div>
                    `;
        }).join('');
      } else {
        if (noHistory) {
          noHistory.style.display = 'block';
        }
        historyList.innerHTML = '<div id="noHistory" style="color: #666; font-style: italic;">No history entries yet</div>';
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      const historyList = document.getElementById('historyList');
      if (historyList) {
        historyList.innerHTML = '<div style="color: #d00;">Error loading history</div>';
      }
    }
  }
});