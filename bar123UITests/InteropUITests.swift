//
//  InteropUITests.swift
//  bar123UITests
//
//  Cross-platform interop tests between Safari iOS and Chrome extension
//

import XCTest

final class InteropUITests: XCTestCase {
    var app: XCUIApplication!
    let testRoomSecret = "interop-test-\(Int(Date().timeIntervalSince1970))"
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        
        // Set launch arguments to enable test mode
        app.launchArguments = ["--uitesting", "--test-room=\(testRoomSecret)"]
    }
    
    @MainActor
    func testChromeToSafariInterop() throws {
        // This test requires:
        // 1. Chrome extension running on a test server
        // 2. iOS app connecting to the same room
        
        // First, start the Chrome extension test server
        // This would be done via a test harness that launches Chrome with the extension
        let chromeTestServer = ChromeExtensionTestServer()
        try chromeTestServer.start(roomSecret: testRoomSecret)
        
        defer {
            chromeTestServer.stop()
        }
        
        // Launch iOS app
        app.launch()
        
        // Connect to the same room
        connectToRoom(secret: testRoomSecret)
        
        // Wait for peer discovery
        waitForPeerConnection(timeout: 30)
        
        // Have Chrome visit some test pages
        try chromeTestServer.visitPages([
            "https://www.example.com",
            "https://www.wikipedia.org",
            "https://www.github.com"
        ])
        
        // Wait for sync
        sleep(5)
        
        // Check if Safari received Chrome's history
        let historyTable = app.tables["historyTable"]
        XCTAssertTrue(waitForElement(historyTable))
        
        // Verify Chrome's history items appear
        XCTAssertTrue(historyTable.cells.containing(.staticText, identifier: "example.com").firstMatch.exists)
        XCTAssertTrue(historyTable.cells.containing(.staticText, identifier: "wikipedia.org").firstMatch.exists)
        
        takeDebugScreenshot(name: "Chrome_history_received")
    }
    
    @MainActor 
    func testSafariToChromeInterop() throws {
        // Test sending history from Safari to Chrome
        
        let chromeTestServer = ChromeExtensionTestServer()
        try chromeTestServer.start(roomSecret: testRoomSecret)
        
        defer {
            chromeTestServer.stop()
        }
        
        // Launch iOS app
        app.launch()
        
        // Connect to room
        connectToRoom(secret: testRoomSecret)
        
        // Wait for peer connection
        waitForPeerConnection(timeout: 30)
        
        // Open Safari and visit pages (simulated via test data)
        if app.buttons["addTestHistory"].exists {
            app.buttons["addTestHistory"].tap()
        } else {
            // Manually add test history entries
            addTestHistoryEntry(url: "https://apple.com", title: "Apple")
            addTestHistoryEntry(url: "https://developer.apple.com", title: "Apple Developer")
        }
        
        // Trigger sync
        if app.buttons["syncHistory"].exists {
            app.buttons["syncHistory"].tap()
        }
        
        // Wait for Chrome to receive the history
        sleep(5)
        
        // Verify Chrome received Safari's history
        let chromeHistory = try chromeTestServer.getHistory()
        XCTAssertTrue(chromeHistory.contains { $0.url.contains("apple.com") })
        XCTAssertTrue(chromeHistory.contains { $0.url.contains("developer.apple.com") })
    }
    
    @MainActor
    func testBidirectionalSync() throws {
        // Test simultaneous bidirectional sync
        
        let chromeTestServer = ChromeExtensionTestServer()
        try chromeTestServer.start(roomSecret: testRoomSecret)
        
        defer {
            chromeTestServer.stop()
        }
        
        app.launch()
        connectToRoom(secret: testRoomSecret)
        waitForPeerConnection(timeout: 30)
        
        // Both sides add history simultaneously
        let group = DispatchGroup()
        
        group.enter()
        DispatchQueue.global().async {
            do {
                // Chrome visits pages
                try chromeTestServer.visitPages([
                    "https://google.com",
                    "https://youtube.com"
                ])
                group.leave()
            } catch {
                XCTFail("Chrome failed to visit pages: \(error)")
                group.leave()
            }
        }
        
        group.enter()
        DispatchQueue.main.async {
            // Safari adds history
            self.addTestHistoryEntry(url: "https://icloud.com", title: "iCloud")
            self.addTestHistoryEntry(url: "https://apple.com/iphone", title: "iPhone")
            
            if self.app.buttons["syncHistory"].exists {
                self.app.buttons["syncHistory"].tap()
            }
            group.leave()
        }
        
        // Wait for both to complete
        let result = group.wait(timeout: .now() + 10)
        XCTAssertEqual(result, .success)
        
        // Wait for sync
        sleep(5)
        
        // Verify Safari has Chrome's history
        let historyTable = app.tables["historyTable"]
        XCTAssertTrue(historyTable.cells.containing(.staticText, identifier: "google.com").firstMatch.exists)
        XCTAssertTrue(historyTable.cells.containing(.staticText, identifier: "youtube.com").firstMatch.exists)
        
        // Verify Chrome has Safari's history
        let chromeHistory = try chromeTestServer.getHistory()
        XCTAssertTrue(chromeHistory.contains { $0.url.contains("icloud.com") })
        XCTAssertTrue(chromeHistory.contains { $0.url.contains("apple.com/iphone") })
    }
    
    @MainActor
    func testConnectionResilience() throws {
        // Test that sync recovers from connection interruptions
        
        let chromeTestServer = ChromeExtensionTestServer()
        try chromeTestServer.start(roomSecret: testRoomSecret)
        
        defer {
            chromeTestServer.stop()
        }
        
        app.launch()
        connectToRoom(secret: testRoomSecret)
        waitForPeerConnection(timeout: 30)
        
        // Simulate connection drop
        chromeTestServer.simulateDisconnect()
        sleep(2)
        
        // Verify disconnection is detected
        XCTAssertTrue(app.staticTexts["Peer disconnected"].exists || 
                     app.staticTexts["Connection lost"].exists)
        
        // Reconnect
        chromeTestServer.simulateReconnect()
        
        // Wait for reconnection
        waitForPeerConnection(timeout: 30)
        
        // Test that sync still works
        try chromeTestServer.visitPages(["https://test.com"])
        sleep(3)
        
        let historyTable = app.tables["historyTable"]
        XCTAssertTrue(historyTable.cells.containing(.staticText, identifier: "test.com").firstMatch.exists)
    }
}

// MARK: - Helper Methods
extension InteropUITests {
    func connectToRoom(secret: String) {
        let roomField = app.textFields["roomSecretField"]
        if roomField.exists {
            roomField.tap()
            roomField.typeText(secret)
            app.buttons["connectButton"].tap()
        }
    }
    
    func waitForPeerConnection(timeout: TimeInterval) {
        let connectedStatus = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Connected'")).firstMatch
        let peerStatus = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'peer'")).firstMatch
        
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true"),
            object: connectedStatus.exists ? connectedStatus : peerStatus
        )
        
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(result, .completed, "Failed to connect to peer")
    }
    
    func addTestHistoryEntry(url: String, title: String) {
        // This depends on your app's UI for adding history
        // Adjust based on actual implementation
    }
    
    func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
        element.waitForExistence(timeout: timeout)
    }
    
    func takeDebugScreenshot(name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

// MARK: - Chrome Extension Test Server
class ChromeExtensionTestServer {
    private var process: Process?
    private var serverURL: String = "http://localhost:9222"
    
    func start(roomSecret: String) throws {
        // Launch Chrome with extension in test mode
        process = Process()
        process?.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process?.arguments = [
            "node",
            "../test/chrome-test-server.js",
            "--room=\(roomSecret)",
            "--port=9222"
        ]
        
        try process?.run()
        
        // Wait for server to be ready
        Thread.sleep(forTimeInterval: 3)
    }
    
    func stop() {
        process?.terminate()
        process?.waitUntilExit()
    }
    
    func visitPages(_ urls: [String]) throws {
        for url in urls {
            let request = URLRequest(url: URL(string: "\(serverURL)/visit?url=\(url)")!)
            let (_, response) = try URLSession.shared.syncRequest(with: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw TestError.chromeCommandFailed
            }
            
            Thread.sleep(forTimeInterval: 1) // Wait between page visits
        }
    }
    
    func getHistory() throws -> [HistoryEntry] {
        let request = URLRequest(url: URL(string: "\(serverURL)/history")!)
        let (data, _) = try URLSession.shared.syncRequest(with: request)
        
        let decoder = JSONDecoder()
        return try decoder.decode([HistoryEntry].self, from: data)
    }
    
    func simulateDisconnect() {
        // Send disconnect command to test server
        var request = URLRequest(url: URL(string: "\(serverURL)/disconnect")!)
        request.httpMethod = "POST"
        _ = try? URLSession.shared.syncRequest(with: request)
    }
    
    func simulateReconnect() {
        // Send reconnect command to test server
        var request = URLRequest(url: URL(string: "\(serverURL)/reconnect")!)
        request.httpMethod = "POST"
        _ = try? URLSession.shared.syncRequest(with: request)
    }
}

// MARK: - Helper Types
struct HistoryEntry: Codable {
    let url: String
    let title: String
    let timestamp: TimeInterval
}

enum TestError: Error {
    case chromeCommandFailed
    case connectionTimeout
}

// MARK: - URLSession Extension for Sync Requests
extension URLSession {
    func syncRequest(with request: URLRequest) throws -> (Data, URLResponse) {
        var data: Data?
        var response: URLResponse?
        var error: Error?
        
        let semaphore = DispatchSemaphore(value: 0)
        
        let task = dataTask(with: request) { d, r, e in
            data = d
            response = r
            error = e
            semaphore.signal()
        }
        
        task.resume()
        semaphore.wait()
        
        if let error = error {
            throw error
        }
        
        guard let data = data, let response = response else {
            throw TestError.connectionTimeout
        }
        
        return (data, response)
    }
}
