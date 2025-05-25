#!/usr/bin/env node

/**
 * Debug Information Collection Script
 * 
 * Extracts the complex debug collection logic from GitHub Actions workflow
 * into a standalone script for easier maintenance and testing.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function collectEnvironmentInfo() {
    console.log('=== Collecting environment information ===');
    
    return {
        node_version: getCommand('node --version', 'not found'),
        npm_version: getCommand('npm --version', 'not found'), 
        xcode_version: getCommand('xcodebuild -version 2>/dev/null | head -1 | sed \'s/Xcode //\'', 'not found'),
        os_version: getCommand('sw_vers -productVersion', 'unknown'),
        available_disk_space: getCommand('df -h . | tail -1 | awk \'{print $4}\'', 'unknown')
    };
}

function getCommand(command, fallback) {
    try {
        return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error) {
        return fallback;
    }
}

function collectLogInfo() {
    console.log('=== Collecting log details ===');
    
    const logs = {};
    
    // Collect test log info
    if (fs.existsSync('test-output.log')) {
        const testLogSize = execSync('wc -l < test-output.log', { encoding: 'utf8' }).trim();
        const testLogExcerpt = execSync('tail -20 test-output.log | jq -R . | jq -s .', { encoding: 'utf8' });
        logs.test_log = {
            size_lines: parseInt(testLogSize),
            excerpt: JSON.parse(testLogExcerpt)
        };
    }
    
    // Collect BrowserStack log info  
    if (fs.existsSync('browserstack-test-output.log')) {
        const browserstackLogSize = execSync('wc -l < browserstack-test-output.log', { encoding: 'utf8' }).trim();
        const browserstackLogExcerpt = execSync('tail -20 browserstack-test-output.log | jq -R . | jq -s .', { encoding: 'utf8' });
        logs.browserstack_test_log = {
            size_lines: parseInt(browserstackLogSize),
            excerpt: JSON.parse(browserstackLogExcerpt)
        };
    }
    
    // Collect iOS build log info
    if (fs.existsSync('ios-build.log')) {
        const iosLogSize = execSync('wc -l < ios-build.log', { encoding: 'utf8' }).trim();
        const iosLogExcerpt = execSync('tail -20 ios-build.log | jq -R . | jq -s .', { encoding: 'utf8' });
        logs.ios_build_log = {
            size_lines: parseInt(iosLogSize),
            excerpt: JSON.parse(iosLogExcerpt)
        };
    }
    
    return logs;
}

function analyzeErrors() {
    console.log('=== Analyzing errors for debugging ===');
    
    const errors = [];
    const testExitCode = parseInt(process.env.TEST_EXIT_CODE || '0');
    const browserstackExitCode = process.env.BROWSERSTACK_TEST_EXIT_CODE ? parseInt(process.env.BROWSERSTACK_TEST_EXIT_CODE) : null;
    const iosExitCode = parseInt(process.env.IOS_BUILD_EXIT_CODE || '0');
    
    // Analyze test failures
    if (testExitCode !== 0) {
        console.log('Analyzing test failures...');
        let errorPatterns = [];
        
        if (fs.existsSync('test-output.log')) {
            try {
                const testOutput = fs.readFileSync('test-output.log', 'utf8');
                const matches = testOutput.match(/error|fail|exception/gi);
                if (matches) {
                    errorPatterns = testOutput.split('\n')
                        .filter(line => /error|fail|exception/i.test(line))
                        .slice(0, 5);
                }
            } catch (error) {
                console.warn('Could not analyze test output:', error.message);
            }
        }
        
        errors.push({
            type: 'test_failure',
            exit_code: testExitCode,
            log_file: 'test-output.log',
            error_patterns: errorPatterns,
            suggested_actions: [
                'Review test logs for specific failure points',
                'Check for dependency issues', 
                'Verify test environment setup'
            ]
        });
    }
    
    // Analyze BrowserStack failures
    if (browserstackExitCode !== null && browserstackExitCode !== 0) {
        console.log('Analyzing BrowserStack failures...');
        let codeSignErrors = [];
        let buildErrors = [];
        
        if (fs.existsSync('browserstack-test-output.log')) {
            try {
                const browserstackOutput = fs.readFileSync('browserstack-test-output.log', 'utf8');
                
                // Look for extension/upload errors
                const extensionMatches = browserstackOutput.split('\n')
                    .filter(line => /extension.*not found|upload.*failed|browserstack.*error/i.test(line))
                    .slice(0, 3);
                
                buildErrors = extensionMatches;
                
            } catch (error) {
                console.warn('Could not analyze BrowserStack output:', error.message);
            }
        }
        
        errors.push({
            type: 'browserstack_failure',
            exit_code: browserstackExitCode,
            log_file: 'browserstack-test-output.log',
            extension_errors: buildErrors,
            suggested_actions: [
                'Check Chrome extension build process',
                'Verify BrowserStack credentials',
                'Review extension upload requirements'
            ]
        });
    }
    
    // Analyze iOS build failures
    if (iosExitCode !== 0) {
        console.log('Analyzing iOS build failures...');
        let codeSignErrors = [];
        let buildErrors = [];
        
        if (fs.existsSync('ios-build.log')) {
            try {
                const iosOutput = fs.readFileSync('ios-build.log', 'utf8');
                
                // Look for code signing issues
                const codeSignMatches = iosOutput.split('\n')
                    .filter(line => /code.*sign|provisioning|certificate/i.test(line))
                    .slice(0, 3);
                
                // Look for build errors
                const buildMatches = iosOutput.split('\n') 
                    .filter(line => /error:|failed|❌/i.test(line))
                    .slice(0, 5);
                
                codeSignErrors = codeSignMatches;
                buildErrors = buildMatches;
                
            } catch (error) {
                console.warn('Could not analyze iOS build output:', error.message);
            }
        }
        
        errors.push({
            type: 'ios_build_failure',
            exit_code: iosExitCode,
            log_file: 'ios-build.log',
            code_signing_errors: codeSignErrors,
            build_errors: buildErrors,
            suggested_actions: [
                'Check provisioning profiles',
                'Verify code signing certificates', 
                'Review Xcode build settings'
            ]
        });
    }
    
    return errors;
}

function createDebugReport() {
    console.log('=== Creating comprehensive debug report ===');
    
    const testExitCode = parseInt(process.env.TEST_EXIT_CODE || '0');
    const browserstackExitCode = process.env.BROWSERSTACK_TEST_EXIT_CODE ? parseInt(process.env.BROWSERSTACK_TEST_EXIT_CODE) : null;
    const iosExitCode = parseInt(process.env.IOS_BUILD_EXIT_CODE || '0');
    
    const report = {
        metadata: {
            timestamp: new Date().toISOString(),
            commit_sha: process.env.GITHUB_SHA,
            event_name: process.env.GITHUB_EVENT_NAME,
            ref: process.env.GITHUB_REF,
            runner_os: process.env.RUNNER_OS,
            runner_arch: process.env.RUNNER_ARCH
        },
        results: {
            tests: {
                exit_code: testExitCode,
                passed: testExitCode === 0
            },
            browserstack_tests: {
                exit_code: browserstackExitCode,
                passed: browserstackExitCode === null ? null : browserstackExitCode === 0,
                ran: browserstackExitCode !== null
            },
            ios_build: {
                exit_code: iosExitCode,
                passed: iosExitCode === 0
            }
        },
        artifacts: {
            chrome_extension: fs.existsSync(`chrome-extension-${process.env.GITHUB_SHA}.zip`),
            ios_ipa: fs.existsSync(`${process.env.RUNNER_TEMP}/build/bar123.ipa`)
        },
        environment: collectEnvironmentInfo(),
        logs: collectLogInfo(),
        error_analysis: analyzeErrors()
    };
    
    // Write debug report
    fs.writeFileSync('build-debug-report.json', JSON.stringify(report, null, 2));
    
    console.log('=== Debug report created ===');
    console.log(`Report size: ${fs.statSync('build-debug-report.json').size} bytes`);
    console.log('Summary:');
    console.log(`Tests: ${testExitCode} (${testExitCode === 0 ? 'PASSED' : 'FAILED'}), BrowserStack: ${browserstackExitCode === null ? 'SKIPPED' : (browserstackExitCode === 0 ? 'PASSED' : 'FAILED')}, iOS Build: ${iosExitCode} (${iosExitCode === 0 ? 'PASSED' : 'FAILED'})`);
    console.log(`Errors found: ${report.error_analysis.length}`);
    
    return report;
}

// Main execution
if (require.main === module) {
    try {
        createDebugReport();
        console.log('✅ Debug information collection completed successfully');
    } catch (error) {
        console.error('❌ Debug collection failed:', error.message);
        process.exit(1);
    }
}

module.exports = { createDebugReport, collectEnvironmentInfo, collectLogInfo, analyzeErrors };