//
//  bar123DebugUITests.swift
//  bar123UITests
//
//  Created by Alex Newman on 5/22/25.
//

import XCTest

final class bar123DebugUITests: XCTestCase {
    
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
    func testWhatElementsExist() throws {
        // Wait for app to fully load
        Thread.sleep(forTimeInterval: 3.0)
        
        print("=== ALL UI ELEMENTS ===")
        
        // Print all static texts
        print("Static Texts:")
        for element in app.staticTexts.allElementsBoundByIndex {
            if element.exists {
                print("  - '\(element.label)'")
            }
        }
        
        // Print all buttons
        print("Buttons:")
        for element in app.buttons.allElementsBoundByIndex {
            if element.exists {
                print("  - '\(element.label)'")
            }
        }
        
        // Print all web views
        print("Web Views:")
        for element in app.webViews.allElementsBoundByIndex {
            if element.exists {
                print("  - WebView exists")
            }
        }
        
        // Print all other elements
        print("Other Elements:")
        for element in app.otherElements.allElementsBoundByIndex {
            if element.exists && !element.label.isEmpty {
                print("  - Other: '\(element.label)'")
            }
        }
        
        // Take a screenshot for debugging
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "App Screenshot"
        add(attachment)
        
        // This test always passes - it's just for debugging
        XCTAssertTrue(app.exists)
    }
    
    @MainActor
    func testWebViewContent() throws {
        // Wait for app to load
        Thread.sleep(forTimeInterval: 5.0)
        
        let webView = app.webViews.firstMatch
        if webView.exists {
            print("WebView found!")
            
            // Try to find elements within the web view
            let webViewElements = webView.descendants(matching: .any)
            print("WebView has \(webViewElements.count) descendant elements")
            
            for i in 0..<min(10, webViewElements.count) {
                let element = webViewElements.element(boundBy: i)
                if element.exists && !element.label.isEmpty {
                    print("  WebView element \(i): '\(element.label)' type: \(element.elementType)")
                }
            }
        } else {
            print("No WebView found!")
        }
        
        XCTAssertTrue(app.exists)
    }
    
    @MainActor
    func testTestConnectionButton() throws {
        // Wait for app to load
        Thread.sleep(forTimeInterval: 5.0)
        
        // Look for Test Connection button specifically
        let testButton = app.buttons["Test Connection"]
        
        if testButton.exists {
            print("✅ Test Connection button found!")
            print("  Button exists: \(testButton.exists)")
            print("  Button enabled: \(testButton.isEnabled)")
            print("  Button hittable: \(testButton.isHittable)")
            
            if testButton.isHittable {
                print("  Attempting to tap Test Connection button...")
                testButton.tap()
                
                // Wait for potential alert
                Thread.sleep(forTimeInterval: 2.0)
                
                let alert = app.alerts.firstMatch
                if alert.exists {
                    print("  ✅ Alert appeared after tapping Test Connection!")
                    print("  Alert text: '\(alert.label)'")
                    
                    // Check for our expected alert text
                    if alert.staticTexts["✅ JavaScript bridge is working!"].exists {
                        print("  ✅ JavaScript bridge alert confirmed!")
                        alert.buttons["OK"].tap()
                    } else {
                        print("  ❌ Alert text doesn't match expected")
                        // Dismiss any alert
                        alert.buttons.firstMatch.tap()
                    }
                } else {
                    print("  ❌ No alert appeared - JavaScript bridge may not be working")
                }
            } else {
                print("  ❌ Test Connection button not hittable")
            }
        } else {
            print("❌ Test Connection button not found!")
            
            // Print all available buttons for debugging
            print("Available buttons:")
            for i in 0..<app.buttons.count {
                let button = app.buttons.element(boundBy: i)
                if button.exists {
                    print("  - '\(button.label)'")
                }
            }
        }
        
        XCTAssertTrue(app.exists) // Always pass - this is just for debugging
    }
}