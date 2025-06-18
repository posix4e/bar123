const { test, expect } = require('@playwright/test');
const { setupExtension, generateSecret } = require('./helpers');

test.describe('STUN-Only Discovery P2P Sync', () => {
    let browser1Context, browser2Context;
    let extension1Id, extension2Id;

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

    test('should establish P2P connection via STUN-only discovery', async () => {
        // Open popup for both extensions
        const popup1 = await browser1Context.newPage();
        await popup1.goto(`chrome-extension://${extension1Id}/popup.html`);
        
        const popup2 = await browser2Context.newPage();
        await popup2.goto(`chrome-extension://${extension2Id}/popup.html`);

        // Configure both extensions for STUN-only
        await test.step('Configure extension 1 for STUN-only', async () => {
            await popup1.click('[data-tab="settings"]');
            await popup1.selectOption('#discoveryMethod', 'stun-only');
            await popup1.click('#saveSettings');
            
            // Wait for STUN settings to appear
            await expect(popup1.locator('#stunSettings')).toBeVisible();
        });

        await test.step('Configure extension 2 for STUN-only', async () => {
            await popup2.click('[data-tab="settings"]');
            await popup2.selectOption('#discoveryMethod', 'stun-only');
            await popup2.click('#saveSettings');
            
            // Wait for STUN settings to appear
            await expect(popup2.locator('#stunSettings')).toBeVisible();
        });

        // Manual connection flow
        await test.step('Create connection offer from extension 1', async () => {
            await popup1.click('#createOffer');
            
            // Wait for offer to be created
            await expect(popup1.locator('#shareOfferStep')).toBeVisible({ timeout: 10000 });
            await expect(popup1.locator('#connectionOffer')).toHaveValue(/.+/, { timeout: 5000 });
        });

        let connectionOffer;
        await test.step('Copy connection offer', async () => {
            connectionOffer = await popup1.locator('#connectionOffer').inputValue();
            expect(connectionOffer).toBeTruthy();
        });

        await test.step('Process offer in extension 2', async () => {
            await popup2.locator('#connectionInput').fill(connectionOffer);
            await popup2.click('#processConnection');
            
            // Wait for response to be generated
            await expect(popup2.locator('#processConnection')).toHaveText('Copy Response', { timeout: 10000 });
        });

        let connectionResponse;
        await test.step('Copy connection response', async () => {
            connectionResponse = await popup2.locator('#connectionInput').inputValue();
            expect(connectionResponse).toBeTruthy();
            expect(connectionResponse).toContain('✅ History Sync Connection Response');
        });

        await test.step('Process response in extension 1', async () => {
            // Clear the offer textarea and paste response
            await popup1.locator('#connectionInput').fill(connectionResponse);
            await popup1.click('#processConnection');
            
            // Wait for connection to establish
            await expect(popup1.locator('#connectionStatusMessage')).toContainText('Connected', { timeout: 15000 });
        });

        // Verify connection on both sides
        await test.step('Verify P2P connection established', async () => {
            await expect(popup1.locator('#connectedPeersList .peer-item')).toHaveCount(1, { timeout: 10000 });
            await expect(popup2.locator('#connectionStatusMessage')).toContainText('Connected', { timeout: 10000 });
        });

        // Test history sync
        await test.step('Test history synchronization via STUN-only', async () => {
            // Navigate to a test page in browser 1
            const testPage1 = await browser1Context.newPage();
            await testPage1.goto('https://example.org');
            await testPage1.waitForTimeout(2000); // Allow time for history tracking

            // Check if history appears in browser 2
            await popup2.click('[data-tab="history"]');
            await expect(popup2.locator('.history-item')).toContainText('example.org', { timeout: 10000 });
        });
    });

    test('should handle connection expiry', async () => {
        const popup = await browser1Context.newPage();
        await popup.goto(`chrome-extension://${extension1Id}/popup.html`);

        await popup.click('[data-tab="settings"]');
        await popup.selectOption('#discoveryMethod', 'stun-only');
        await popup.click('#saveSettings');
        
        // Create offer
        await popup.click('#createOffer');
        await expect(popup.locator('#shareOfferStep')).toBeVisible();
        
        // Verify expiry timer is shown
        await expect(popup.locator('.help-text')).toContainText('expires in', { timeout: 5000 });
    });
});