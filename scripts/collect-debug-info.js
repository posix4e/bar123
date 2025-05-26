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
    
    // Collect local multiplatform test log info  
    if (fs.existsSync('local-multiplatform-test-output.log')) {
        const localTestLogSize = execSync('wc -l < local-multiplatform-test-output.log', { encoding: 'utf8' }).trim();
        const localTestLogExcerpt = execSync('tail -20 local-multiplatform-test-output.log | jq -R . | jq -s .', { encoding: 'utf8' });
        logs.local_multiplatform_test_log = {
            size_lines: parseInt(localTestLogSize),
            excerpt: JSON.parse(localTestLogExcerpt)
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
    
    // Collect TestFlight upload log info
    if (fs.existsSync('testflight-upload.log')) {
        const testflightLogSize = execSync('wc -l < testflight-upload.log', { encoding: 'utf8' }).trim();
        const testflightLogExcerpt = execSync('tail -20 testflight-upload.log | jq -R . | jq -s .', { encoding: 'utf8' });
        logs.testflight_upload_log = {
            size_lines: parseInt(testflightLogSize),
            excerpt: JSON.parse(testflightLogExcerpt)
        };
    }
    
    return logs;
}

function analyzeErrors() {
    console.log('=== Analyzing errors for debugging ===');
    
    const errors = [];
    const testExitCode = parseInt(process.env.TEST_EXIT_CODE || '0');
    const localTestExitCode = process.env.LOCAL_MULTIPLATFORM_TEST_EXIT_CODE ? parseInt(process.env.LOCAL_MULTIPLATFORM_TEST_EXIT_CODE) : null;
    const iosExitCode = parseInt(process.env.IOS_BUILD_EXIT_CODE || '0');
    const testflightExitCode = process.env.TESTFLIGHT_EXIT_CODE ? parseInt(process.env.TESTFLIGHT_EXIT_CODE) : null;
    
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
    
    // Analyze local multiplatform test failures
    if (localTestExitCode !== null && localTestExitCode !== 0) {
        console.log('Analyzing local multiplatform test failures...');
        let testErrors = [];
        
        if (fs.existsSync('local-multiplatform-test-output.log')) {
            try {
                const localTestOutput = fs.readFileSync('local-multiplatform-test-output.log', 'utf8');
                
                // Look for test errors
                const errorMatches = localTestOutput.split('\n')
                    .filter(line => /error|failed|timeout|screenshot.*failed/i.test(line))
                    .slice(0, 5);
                
                testErrors = errorMatches;
                
            } catch (error) {
                console.warn('Could not analyze local test output:', error.message);
            }
        }
        
        errors.push({
            type: 'local_test_failure',
            exit_code: localTestExitCode,
            log_file: 'local-multiplatform-test-output.log',
            test_errors: testErrors,
            suggested_actions: [
                'Check Chrome extension loading',
                'Verify Playwright browser installation',
                'Review iOS Simulator availability',
                'Check test screenshot generation'
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
    
    // Analyze TestFlight upload failures
    if (testflightExitCode !== null && testflightExitCode !== 0) {
        console.log('Analyzing TestFlight upload failures...');
        let uploadErrors = [];
        
        if (fs.existsSync('testflight-upload.log')) {
            try {
                const testflightOutput = fs.readFileSync('testflight-upload.log', 'utf8');
                
                // Look for upload errors
                const uploadMatches = testflightOutput.split('\n')
                    .filter(line => /error|failed|invalid|rejected/i.test(line))
                    .slice(0, 5);
                
                uploadErrors = uploadMatches;
                
            } catch (error) {
                console.warn('Could not analyze TestFlight output:', error.message);
            }
        }
        
        errors.push({
            type: 'testflight_upload_failure',
            exit_code: testflightExitCode,
            log_file: 'testflight-upload.log',
            upload_errors: uploadErrors,
            suggested_actions: [
                'Check Apple ID credentials',
                'Verify app-specific password',
                'Review app bundle requirements',
                'Check TestFlight processing status'
            ]
        });
    }
    
    return errors;
}

function createDebugReport() {
    console.log('=== Creating comprehensive debug report ===');
    
    const testExitCode = parseInt(process.env.TEST_EXIT_CODE || '0');
    const localTestExitCode = process.env.LOCAL_MULTIPLATFORM_TEST_EXIT_CODE ? parseInt(process.env.LOCAL_MULTIPLATFORM_TEST_EXIT_CODE) : null;
    const iosExitCode = parseInt(process.env.IOS_BUILD_EXIT_CODE || '0');
    const testflightExitCode = process.env.TESTFLIGHT_EXIT_CODE ? parseInt(process.env.TESTFLIGHT_EXIT_CODE) : null;
    
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
            local_tests: {
                exit_code: localTestExitCode,
                passed: localTestExitCode === null ? null : localTestExitCode === 0,
                ran: localTestExitCode !== null
            },
            ios_build: {
                exit_code: iosExitCode,
                passed: iosExitCode === 0
            },
            testflight_upload: {
                exit_code: testflightExitCode,
                passed: testflightExitCode === null ? null : testflightExitCode === 0,
                ran: testflightExitCode !== null
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
    console.log(`Tests: ${testExitCode} (${testExitCode === 0 ? 'PASSED' : 'FAILED'}), Local Tests: ${localTestExitCode === null ? 'SKIPPED' : (localTestExitCode === 0 ? 'PASSED' : 'FAILED')}, iOS Build: ${iosExitCode} (${iosExitCode === 0 ? 'PASSED' : 'FAILED'})`);
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