const { test, expect } = require('@playwright/test');
const { setupExtension, generateSecret } = require('./helpers');

test.describe('WebSocket Discovery P2P Sync', () => {
    let browser1Context, browser2Context;
    let extension1Id, extension2Id;
    const sharedSecret = generateSecret();
    const roomId = `test-room-${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
        // Setup two browser contexts with the extension
        const setup1 = await setupExtension(browser);
        const setup2 = await setupExtension(browser);
        
        browser1Context = setup1.context;
        browser2Context = setup2.context;
        extension1Id = setup1.extensionId;
        extension2Id = setup2.extensionId;
    });

    test.afterAll(async () => {
        await browser1Context?.close();
        await browser2Context?.close();
    });

    test('should establish P2P connection via WebSocket discovery', async () => {
        // Open popup for both extensions
        const popup1 = await browser1Context.newPage();
        await popup1.goto(`chrome-extension://${extension1Id}/popup.html`);
        
        const popup2 = await browser2Context.newPage();
        await popup2.goto(`chrome-extension://${extension2Id}/popup.html`);

        // Configure both extensions
        await test.step('Configure extension 1', async () => {
            await popup1.click('[data-tab="settings"]');
            await popup1.selectOption('#discoveryMethod', 'websocket');
            await popup1.fill('#serverUrl', 'ws://localhost:8080');
            await popup1.fill('#roomId', roomId);
            await popup1.fill('#sharedSecret', sharedSecret);
            await popup1.click('#saveSettings');
            
            // Wait for connection
            await expect(popup1.locator('.status-indicator')).toHaveClass(/connected/, { timeout: 10000 });
        });

        await test.step('Configure extension 2', async () => {
            await popup2.click('[data-tab="settings"]');
            await popup2.selectOption('#discoveryMethod', 'websocket');
            await popup2.fill('#serverUrl', 'ws://localhost:8080');
            await popup2.fill('#roomId', roomId);
            await popup2.fill('#sharedSecret', sharedSecret);
            await popup2.click('#saveSettings');
            
            // Wait for connection
            await expect(popup2.locator('.status-indicator')).toHaveClass(/connected/, { timeout: 10000 });
        });

        // Verify devices see each other
        await test.step('Verify peer discovery', async () => {
            await popup1.click('[data-tab="devices"]');
            await popup2.click('[data-tab="devices"]');
            
            // Each should see one connected device
            await expect(popup1.locator('.device-item')).toHaveCount(1, { timeout: 10000 });
            await expect(popup2.locator('.device-item')).toHaveCount(1, { timeout: 10000 });
        });

        // Test history sync
        await test.step('Test history synchronization', async () => {
            // Navigate to a test page in browser 1
            const testPage1 = await browser1Context.newPage();
            await testPage1.goto('https://example.com');
            await testPage1.waitForTimeout(2000); // Allow time for history tracking

            // Check if history appears in browser 2
            await popup2.click('[data-tab="history"]');
            await expect(popup2.locator('.history-item')).toContainText('example.com', { timeout: 10000 });
        });
    });

    test('should handle disconnection and reconnection', async () => {
        const popup1 = await browser1Context.newPage();
        await popup1.goto(`chrome-extension://${extension1Id}/popup.html`);

        // Disconnect
        await popup1.click('[data-tab="settings"]');
        await popup1.click('#disconnectButton');
        await expect(popup1.locator('.status-indicator')).not.toHaveClass(/connected/);

        // Reconnect
        await popup1.click('#saveSettings');
        await expect(popup1.locator('.status-indicator')).toHaveClass(/connected/, { timeout: 10000 });
    });
});