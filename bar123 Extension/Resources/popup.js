document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const sharedSecretInput = document.getElementById('sharedSecret');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  const fileInput = document.getElementById('fileInput');
  const shareFileBtn = document.getElementById('shareFileBtn');
  const sharePasswordBtn = document.getElementById('sharePasswordBtn');
  const expirationSelect = document.getElementById('expirationSelect');
  
  const showFilesBtn = document.getElementById('showFilesBtn');
  const showPasswordsBtn = document.getElementById('showPasswordsBtn');
  const showHistoryBtn = document.getElementById('showHistoryBtn');
  
  let currentView = 'history';
    
  // Load initial state
  updateUI();
  loadItems();
    
  connectBtn.addEventListener('click', async () => {
    const secret = sharedSecretInput.value.trim();
    if (!secret) {
      alert('Please enter a shared secret');
      return;
    }
        
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
        
    try {
      const response = await browser.runtime.sendMessage({
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
    await browser.runtime.sendMessage({ action: 'disconnect' });
    updateUI();
  });
    
  refreshBtn.addEventListener('click', () => {
    loadItems();
  });

  shareFileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    try {
      const content = await readFileAsBase64(file);
      const expiresAt = getExpirationTime();

      const response = await browser.runtime.sendMessage({
        action: 'shareFile',
        fileData: {
          name: file.name,
          content: content,
          type: file.type,
          size: file.size
        },
        expiresAt: expiresAt
      });

      if (response.success) {
        alert('File shared successfully!');
        loadItems();
      } else {
        alert('Failed to share file: ' + response.error);
      }
    } catch (error) {
      alert('Error sharing file: ' + error.message);
    }
  });

  sharePasswordBtn.addEventListener('click', async () => {
    showPasswordForm();
  });

  showFilesBtn.addEventListener('click', () => {
    currentView = 'files';
    updateViewButtons();
    loadItems();
  });

  showPasswordsBtn.addEventListener('click', () => {
    currentView = 'passwords';
    updateViewButtons();
    loadItems();
  });

  showHistoryBtn.addEventListener('click', () => {
    currentView = 'history';
    updateViewButtons();
    loadItems();
  });

  function updateViewButtons() {
    showFilesBtn.className = currentView === 'files' ? 'primary' : 'secondary';
    showPasswordsBtn.className = currentView === 'passwords' ? 'primary' : 'secondary';
    showHistoryBtn.className = currentView === 'history' ? 'primary' : 'secondary';
  }

  function getExpirationTime() {
    const expirationMs = parseInt(expirationSelect.value);
    return expirationMs ? Date.now() + expirationMs : null;
  }

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showPasswordForm() {
    const title = prompt('Password title:');
    if (!title) return;

    const username = prompt('Username (optional):') || '';
    const password = prompt('Password:');
    if (!password) return;

    const website = prompt('Website (optional):') || '';
    const notes = prompt('Notes (optional):') || '';

    sharePassword({
      title: title,
      username: username,
      password: password,
      website: website,
      notes: notes
    });
  }

  async function sharePassword(passwordData) {
    try {
      const expiresAt = getExpirationTime();

      const response = await browser.runtime.sendMessage({
        action: 'sharePassword',
        passwordData: passwordData,
        expiresAt: expiresAt
      });

      if (response.success) {
        alert('Password shared successfully!');
        loadItems();
      } else {
        alert('Failed to share password: ' + response.error);
      }
    } catch (error) {
      alert('Error sharing password: ' + error.message);
    }
  }
    
  async function updateUI() {
    try {
      const stats = await browser.runtime.sendMessage({ action: 'getStats' });
            
      if (stats.isConnected) {
        statusDiv.className = 'status connected';
        statusDiv.textContent = `Connected (${stats.deviceCount} peers)`;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
      } else {
        statusDiv.className = 'status disconnected';
        statusDiv.textContent = 'Disconnected';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to update UI:', error);
    }
  }
    
  async function loadItems() {
    try {
      const itemsList = document.getElementById('itemsList');
      const noItems = document.getElementById('noItems');

      if (currentView === 'history') {
        const response = await browser.runtime.sendMessage({ action: 'getHistory' });
        
        if (response.success && response.history && response.history.length > 0) {
          noItems.style.display = 'none';
          itemsList.innerHTML = response.history.map(entry => {
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
          noItems.style.display = 'block';
          itemsList.innerHTML = '<div style="color: #666; font-style: italic;">No history entries yet</div>';
        }
      } else {
        const response = await browser.runtime.sendMessage({ action: 'getSharedItems' });
        
        if (response.success) {
          const items = currentView === 'files' ? response.files : response.passwords;
          
          if (items && items.length > 0) {
            noItems.style.display = 'none';
            itemsList.innerHTML = items.map(item => {
              const date = new Date(item.sharedAt).toLocaleString();
              const sourceDevice = item.sourceDevice ? ` (${item.sourceDevice.split('_')[0]})` : '';
              const expiresText = item.expiresAt ? 
                ` • Expires: ${new Date(item.expiresAt).toLocaleString()}` : ' • Never expires';
              
              if (currentView === 'files') {
                const sizeText = formatFileSize(item.size);
                return `
                  <div style="border-bottom: 1px solid #eee; padding: 4px 0;">
                    <div style="font-weight: bold; color: #007bff; cursor: pointer;" onclick="downloadFile('${item.id}')">
                      📁 ${item.name}
                    </div>
                    <div style="color: #666; font-size: 10px;">
                      ${sizeText} • ${item.type || 'Unknown type'}
                    </div>
                    <div style="color: #999; font-size: 10px;">
                      ${date}${sourceDevice}${expiresText}
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div style="border-bottom: 1px solid #eee; padding: 4px 0;">
                    <div style="font-weight: bold; color: #007bff; cursor: pointer;" onclick="showPassword('${item.id}')">
                      🔒 ${item.title}
                    </div>
                    <div style="color: #666; font-size: 10px;">
                      ${item.username ? `User: ${item.username}` : ''} ${item.website ? `• ${item.website}` : ''}
                    </div>
                    <div style="color: #999; font-size: 10px;">
                      ${date}${sourceDevice}${expiresText}
                    </div>
                  </div>
                `;
              }
            }).join('');
          } else {
            noItems.style.display = 'block';
            itemsList.innerHTML = `<div style="color: #666; font-style: italic;">No ${currentView} shared yet</div>`;
          }
        } else {
          itemsList.innerHTML = '<div style="color: #d00;">Error loading items</div>';
        }
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      const itemsList = document.getElementById('itemsList');
      itemsList.innerHTML = '<div style="color: #d00;">Error loading items</div>';
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Global functions for onclick handlers
  window.downloadFile = async function(fileId) {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getSharedItems' });
      const file = response.files.find(f => f.id === fileId);
      if (!file) return;

      const link = document.createElement('a');
      link.href = file.content;
      link.download = file.name;
      link.click();
    } catch (error) {
      alert('Error downloading file: ' + error.message);
    }
  };

  window.showPassword = async function(passwordId) {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getSharedItems' });
      const password = response.passwords.find(p => p.id === passwordId);
      if (!password) return;

      let message = `Title: ${password.title}\n`;
      if (password.username) message += `Username: ${password.username}\n`;
      message += `Password: ${password.password}\n`;
      if (password.website) message += `Website: ${password.website}\n`;
      if (password.notes) message += `Notes: ${password.notes}`;

      alert(message);
    } catch (error) {
      alert('Error showing password: ' + error.message);
    }
  };
});