class HistorySyncUI {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.updateUI();
  }

  initializeElements() {
    this.openAppBtn = document.getElementById('openAppBtn');
    this.syncStatus = document.getElementById('syncStatus');
    this.localCount = document.getElementById('localCount');
    this.lastSync = document.getElementById('lastSync');
  }

  bindEvents() {
    this.openAppBtn.addEventListener('click', () => this.openMainApp());
  }

  async openMainApp() {
    try {
      // Try to open the iOS app via custom URL scheme
      const appURL = 'bar123://open';
      window.open(appURL, '_blank');
    } catch (error) {
      console.log('Could not open app directly:', error);
      this.showAppInstructions();
    }
  }

  showAppInstructions() {
    const instructions = `
      To use History Sync:
      
      1. Open the History Sync app on your device
      2. Configure your room secret
      3. Your browsing history will sync automatically
      
      The extension works in the background to capture your browsing data.
    `;
    
    alert(instructions);
  }

  async updateUI() {
    try {
      // Get basic stats from storage
      const stats = await browser.storage.local.get([
        'localHistoryCount',
        'lastSyncTime',
        'isConnected'
      ]);

      // Update connection status
      const isConnected = stats.isConnected || false;
      this.syncStatus.textContent = isConnected ? '● Connected' : '● Disconnected';
      this.syncStatus.style.color = isConnected ? '#059669' : '#dc2626';

      // Update stats
      this.localCount.textContent = stats.localHistoryCount || '0';
      
      if (stats.lastSyncTime) {
        const lastSync = new Date(stats.lastSyncTime);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSync) / (1000 * 60));
        
        if (diffMinutes < 1) {
          this.lastSync.textContent = 'Just now';
        } else if (diffMinutes < 60) {
          this.lastSync.textContent = `${diffMinutes}m ago`;
        } else {
          const diffHours = Math.floor(diffMinutes / 60);
          this.lastSync.textContent = `${diffHours}h ago`;
        }
      } else {
        this.lastSync.textContent = 'Never';
      }
    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HistorySyncUI();
});