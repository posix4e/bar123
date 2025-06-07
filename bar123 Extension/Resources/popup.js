// Popup UI controller
class PopupController {
    constructor() {
        this.nativeAppId = "xyz.foo.bar123.Extension";
        this.initializeUI();
    }

    async initializeUI() {
        // Get UI elements
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.sharedSecretInput = document.getElementById('sharedSecret');
        this.setSecretBtn = document.getElementById('setSecretBtn');
        this.secretStatus = document.getElementById('secretStatus');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
        this.devicesList = document.getElementById('devicesList');

        // Set up event listeners
        this.setSecretBtn.addEventListener('click', () => this.setSharedSecret());
        this.searchBtn.addEventListener('click', () => this.searchHistory());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchHistory();
        });
        this.refreshDevicesBtn.addEventListener('click', () => this.refreshDevices());

        // Check initial sync status
        await this.checkSyncStatus();
        
        // Load devices if syncing
        const status = await browser.storage.local.get('syncStatus');
        if (status.syncStatus?.syncing) {
            await this.refreshDevices();
        }
    }

    async checkSyncStatus() {
        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "getSyncStatus"
            });
            
            await browser.storage.local.set({ syncStatus: response });
            
            if (response.syncing) {
                this.statusDot.className = 'status-dot active';
                this.statusText.textContent = 'Syncing';
                this.sharedSecretInput.placeholder = 'Secret already set';
                this.sharedSecretInput.disabled = true;
                this.setSecretBtn.textContent = 'Active';
                this.setSecretBtn.disabled = true;
            } else {
                this.statusDot.className = 'status-dot inactive';
                this.statusText.textContent = 'Not syncing';
                if (response.hasSharedSecret) {
                    this.sharedSecretInput.placeholder = 'Secret already set';
                }
            }
        } catch (error) {
            console.error('Error checking sync status:', error);
            this.statusDot.className = 'status-dot inactive';
            this.statusText.textContent = 'Error';
        }
    }

    async setSharedSecret() {
        const secret = this.sharedSecretInput.value.trim();
        if (!secret) {
            this.showSecretStatus('Please enter a shared secret', 'error');
            return;
        }

        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "setSharedSecret",
                secret: secret
            });

            if (response.success) {
                this.showSecretStatus('Secret set successfully!', 'success');
                this.sharedSecretInput.value = '';
                await this.checkSyncStatus();
                await this.refreshDevices();
            } else {
                this.showSecretStatus('Failed to set secret', 'error');
            }
        } catch (error) {
            console.error('Error setting shared secret:', error);
            this.showSecretStatus('Error setting secret', 'error');
        }
    }

    showSecretStatus(message, type) {
        this.secretStatus.textContent = message;
        this.secretStatus.className = `status-message ${type}`;
        setTimeout(() => {
            this.secretStatus.textContent = '';
            this.secretStatus.className = 'status-message';
        }, 3000);
    }

    async searchHistory() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        this.searchBtn.disabled = true;
        this.searchBtn.textContent = 'Searching...';
        this.searchResults.innerHTML = '<div style="text-align: center; padding: 20px;">Searching...</div>';

        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "searchHistory",
                query: query
            });

            if (response.success && response.results) {
                this.displaySearchResults(response.results);
            } else {
                this.searchResults.innerHTML = '<div style="text-align: center; padding: 20px;">No results found</div>';
            }
        } catch (error) {
            console.error('Error searching history:', error);
            this.searchResults.innerHTML = '<div style="text-align: center; padding: 20px; color: #f44336;">Error searching history</div>';
        } finally {
            this.searchBtn.disabled = false;
            this.searchBtn.textContent = 'Search';
        }
    }

    displaySearchResults(results) {
        if (results.length === 0) {
            this.searchResults.innerHTML = '<div style="text-align: center; padding: 20px;">No results found</div>';
            return;
        }

        this.searchResults.innerHTML = results.map(result => {
            const date = new Date(result.timestamp * 1000);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            return `
                <div class="result-item">
                    <div class="result-title">${this.escapeHtml(result.title)}</div>
                    <div class="result-url">${this.escapeHtml(result.url)}</div>
                    <div class="result-device">${this.escapeHtml(result.deviceName)} • ${dateStr}</div>
                </div>
            `;
        }).join('');
    }

    async refreshDevices() {
        this.refreshDevicesBtn.disabled = true;
        this.refreshDevicesBtn.textContent = 'Loading...';
        this.devicesList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading devices...</div>';

        try {
            const response = await browser.runtime.sendNativeMessage(this.nativeAppId, {
                action: "getDevices"
            });

            if (response.success && response.devices) {
                this.displayDevices(response.devices);
            } else {
                this.devicesList.innerHTML = '<div style="text-align: center; padding: 20px;">No devices found</div>';
            }
        } catch (error) {
            console.error('Error getting devices:', error);
            this.devicesList.innerHTML = '<div style="text-align: center; padding: 20px; color: #f44336;">Error loading devices</div>';
        } finally {
            this.refreshDevicesBtn.disabled = false;
            this.refreshDevicesBtn.textContent = 'Refresh';
        }
    }

    displayDevices(devices) {
        if (devices.length === 0) {
            this.devicesList.innerHTML = '<div style="text-align: center; padding: 20px;">No devices connected</div>';
            return;
        }

        this.devicesList.innerHTML = devices.map(device => `
            <div class="device-item">
                <div class="device-name">${this.escapeHtml(device.name)}</div>
                <div class="device-info">${this.escapeHtml(device.model)} • iOS ${this.escapeHtml(device.osVersion)}</div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
