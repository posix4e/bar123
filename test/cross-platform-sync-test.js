#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CrossPlatformSyncTester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            platform: 'cross-platform-integration',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0
            }
        };
    }

    addTestResult(testName, passed, details = {}) {
        const result = {
            name: testName,
            passed,
            timestamp: new Date().toISOString(),
            details
        };
        
        this.testResults.tests.push(result);
        this.testResults.summary.total++;
        
        if (passed) {
            this.testResults.summary.passed++;
            console.log(`✅ ${testName}: PASSED`);
        } else {
            this.testResults.summary.failed++;
            console.log(`❌ ${testName}: FAILED`);
            if (details.error) {
                console.log(`   Error: ${details.error}`);
            }
        }
    }

    async testChromeExtensionExists() {
        console.log('🧪 Testing Chrome extension exists...');
        
        try {
            const manifestExists = fs.existsSync('chrome-extension/manifest.json');
            const backgroundExists = fs.existsSync('chrome-extension/background.js');
            const popupExists = fs.existsSync('chrome-extension/popup.html');
            
            let manifestValid = false;
            if (manifestExists) {
                const manifest = JSON.parse(fs.readFileSync('chrome-extension/manifest.json', 'utf8'));
                manifestValid = manifest.manifest_version === 3 && manifest.name === 'History Sync';
            }
            
            this.addTestResult('Chrome Extension Structure', 
                manifestExists && backgroundExists && popupExists && manifestValid, {
                manifestExists,
                backgroundExists,
                popupExists,
                manifestValid
            });
            
        } catch (error) {
            this.addTestResult('Chrome Extension Structure', false, {
                error: error.message
            });
        }
    }

    async testSafariExtensionEnhancement() {
        console.log('🧪 Testing Safari extension enhancement...');
        
        try {
            const backgroundPath = 'bar123 Extension/Resources/background.js';
            const backgroundExists = fs.existsSync(backgroundPath);
            
            let hasIOSDeviceId = false;
            if (backgroundExists) {
                const content = fs.readFileSync(backgroundPath, 'utf8');
                hasIOSDeviceId = content.includes('ios_safari_');
            }
            
            this.addTestResult('Safari Extension Enhancement', 
                backgroundExists && hasIOSDeviceId, {
                backgroundExists,
                hasIOSDeviceId
            });
            
        } catch (error) {
            this.addTestResult('Safari Extension Enhancement', false, {
                error: error.message
            });
        }
    }

    async testPackageJsonUpdates() {
        console.log('🧪 Testing package.json updates...');
        
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            const hasBuildChrome = packageJson.scripts['build-chrome'] !== undefined;
            const hasTestScripts = packageJson.scripts['test'] !== undefined;
            const hasPuppeteer = packageJson.devDependencies && 
                               packageJson.devDependencies['puppeteer'] !== undefined;
            
            this.addTestResult('Package JSON Updates', 
                hasBuildChrome && hasTestScripts && hasPuppeteer, {
                hasBuildChrome,
                hasTestScripts,
                hasPuppeteer
            });
            
        } catch (error) {
            this.addTestResult('Package JSON Updates', false, {
                error: error.message
            });
        }
    }

    async testGitHubWorkflows() {
        console.log('🧪 Testing GitHub workflows...');
        
        try {
            const workflowExists = fs.existsSync('.github/workflows/ci-cd.yml');
            
            let workflowValid = false;
            if (workflowExists) {
                const workflow = fs.readFileSync('.github/workflows/ci-cd.yml', 'utf8');
                workflowValid = workflow.includes('CI/CD Pipeline') && 
                               workflow.includes('build-and-test') &&
                               workflow.includes('test-ios') &&
                               workflow.includes('deploy-testflight');
            }
            
            this.addTestResult('GitHub Workflows', workflowExists && workflowValid, {
                workflowExists,
                workflowValid
            });
            
        } catch (error) {
            this.addTestResult('GitHub Workflows', false, {
                error: error.message
            });
        }
    }

    async saveResults() {
        const resultsDir = './test-results/sync';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const resultsFile = path.join(resultsDir, 'test-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.testResults, null, 2));
        
        console.log(`💾 Results saved to ${resultsFile}`);
    }

    async run() {
        try {
            console.log('🧪 Starting multiplatform sync validation tests...');
            
            await this.testChromeExtensionExists();
            await this.testSafariExtensionEnhancement();
            await this.testPackageJsonUpdates();
            await this.testGitHubWorkflows();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.addTestResult('Test Suite', false, { error: error.message });
        } finally {
            await this.saveResults();
            
            // Print summary
            console.log('\n📊 Test Summary:');
            console.log(`   Total: ${this.testResults.summary.total}`);
            console.log(`   Passed: ${this.testResults.summary.passed}`);
            console.log(`   Failed: ${this.testResults.summary.failed}`);
            
            // Exit with appropriate code
            process.exit(this.testResults.summary.failed > 0 ? 1 : 0);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new CrossPlatformSyncTester();
    tester.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = CrossPlatformSyncTester;