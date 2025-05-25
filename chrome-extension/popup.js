document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const sharedSecretInput = document.getElementById('sharedSecret');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    // Load initial state
    updateUI();
    
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
    
    async function updateUI() {
        try {
            const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
            
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
});