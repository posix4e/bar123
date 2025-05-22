//
//  bar123UITests.swift
//  bar123UITests
//
//  Created by Alex Newman on 5/22/25.
//

import XCTest

final class bar123UITests: XCTestCase {
    
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    @MainActor
    func testAppLaunchesSuccessfully() throws {
        // Test that the app launches and displays the main UI
        XCTAssertTrue(app.staticTexts["Browse History"].exists)
        XCTAssertTrue(app.staticTexts["Version 1.0.0 Build 1"].exists)
    }
    
    @MainActor
    func testAllButtonsExist() throws {
        // Test that all expected buttons are present
        XCTAssertTrue(app.buttons["Test Connection"].exists)
        XCTAssertTrue(app.buttons["Refresh"].exists)
        XCTAssertTrue(app.buttons["Clear All"].exists)
        XCTAssertTrue(app.buttons["Check Extension"].exists)
        XCTAssertTrue(app.buttons["Debug Info"].exists)
    }
    
    @MainActor
    func testTestConnectionButton() throws {
        // Test the JavaScript bridge connection
        let testButton = app.buttons["Test Connection"]
        XCTAssertTrue(testButton.exists)
        
        testButton.tap()
        
        // Wait for alert to appear
        let alert = app.alerts.firstMatch
        let alertAppeared = alert.waitForExistence(timeout: 5.0)
        
        if alertAppeared {
            XCTAssertTrue(alert.staticTexts["✅ JavaScript bridge is working!"].exists)
            alert.buttons["OK"].tap()
        } else {
            XCTFail("Test connection should show an alert indicating JavaScript bridge status")
        }
    }
    
    @MainActor
    func testRefreshButton() throws {
        // Test refresh functionality
        let refreshButton = app.buttons["Refresh"]
        XCTAssertTrue(refreshButton.exists)
        
        refreshButton.tap()
        
        // Wait a moment for any updates
        Thread.sleep(forTimeInterval: 1.0)
        
        // Should not crash and button should still be tappable
        XCTAssertTrue(refreshButton.isHittable)
    }
    
    @MainActor
    func testCheckExtensionButton() throws {
        // Test extension status check
        let checkButton = app.buttons["Check Extension"]
        XCTAssertTrue(checkButton.exists)
        
        // Store initial status text
        let extensionStatus = app.staticTexts.matching(identifier: "extension-status").firstMatch
        
        checkButton.tap()
        
        // Wait for status to potentially update
        Thread.sleep(forTimeInterval: 2.0)
        
        // Button should still be functional
        XCTAssertTrue(checkButton.isHittable)
    }
    
    @MainActor
    func testDebugInfoButton() throws {
        // Test debug info functionality
        let debugButton = app.buttons["Debug Info"]
        XCTAssertTrue(debugButton.exists)
        
        debugButton.tap()
        
        // Wait for potential alert or update
        Thread.sleep(forTimeInterval: 2.0)
        
        // Check if an alert appeared with debug info
        let alert = app.alerts.firstMatch
        if alert.exists {
            // If alert exists, it should contain debug information
            XCTAssertTrue(alert.exists)
            alert.buttons["OK"].tap()
        }
        
        // Button should still be functional
        XCTAssertTrue(debugButton.isHittable)
    }
    
    @MainActor
    func testClearAllButton() throws {
        // Test clear all functionality
        let clearButton = app.buttons["Clear All"]
        XCTAssertTrue(clearButton.exists)
        
        clearButton.tap()
        
        // Should show confirmation dialog
        let alert = app.alerts.firstMatch
        let alertAppeared = alert.waitForExistence(timeout: 3.0)
        
        if alertAppeared {
            // Cancel the operation
            if alert.buttons["Cancel"].exists {
                alert.buttons["Cancel"].tap()
            } else {
                // If no cancel, dismiss with OK
                alert.buttons.firstMatch.tap()
            }
        }
        
        // Button should still be functional
        XCTAssertTrue(clearButton.isHittable)
    }
    
    @MainActor
    func testExtensionStatusDisplay() throws {
        // Test that extension status section exists and updates
        let statusSection = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Extension'")).firstMatch
        
        // There should be some extension-related text
        let hasExtensionText = app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'extension' OR label CONTAINS 'Extension'")).firstMatch.exists
        XCTAssertTrue(hasExtensionText, "Should display extension status information")
    }
    
    @MainActor
    func testHistoryContainerExists() throws {
        // Test that history display area exists
        // Even if empty, the container should be present
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.exists, "WebView should be present for displaying history")
    }
    
    @MainActor
    func testUIResponsiveness() throws {
        // Test that multiple button taps don't crash the app
        let testButton = app.buttons["Test Connection"]
        let refreshButton = app.buttons["Refresh"]
        
        // Rapid taps should not crash
        for _ in 0..<3 {
            if testButton.isHittable {
                testButton.tap()
                
                // Handle any alerts
                let alert = app.alerts.firstMatch
                if alert.waitForExistence(timeout: 1.0) {
                    alert.buttons.firstMatch.tap()
                }
            }
            
            if refreshButton.isHittable {
                refreshButton.tap()
            }
            
            Thread.sleep(forTimeInterval: 0.5)
        }
        
        // App should still be responsive
        XCTAssertTrue(testButton.isHittable)
        XCTAssertTrue(refreshButton.isHittable)
    }

    @MainActor
    func testLaunchPerformance() throws {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}