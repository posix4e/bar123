// Extension to ViewController for configurable relay support
import Foundation

extension ViewController {
    // Get relay URLs from environment or use defaults
    static func getRelayUrls() -> [String] {
        // Check for environment variable
        if let testRelay = ProcessInfo.processInfo.environment["TEST_RELAY_URL"] {
            print("Using test relay from environment: \(testRelay)")
            return [testRelay]
        }
        
        // Check for command line argument
        let arguments = ProcessInfo.processInfo.arguments
        if let relayIndex = arguments.firstIndex(of: "--relay"),
           relayIndex + 1 < arguments.count {
            let relayUrl = arguments[relayIndex + 1]
            print("Using test relay from arguments: \(relayUrl)")
            return [relayUrl]
        }
        
        // Check UserDefaults for test configuration
        if let testRelay = UserDefaults.standard.string(forKey: "test_relay_url") {
            print("Using test relay from UserDefaults: \(testRelay)")
            return [testRelay]
        }
        
        // Default production relay
        return ["wss://relay.snort.social"]
    }
}

// Helper for test scripts to set relay URL
@objc public class TestConfiguration: NSObject {
    @objc public static func setTestRelayUrl(_ url: String) {
        UserDefaults.standard.set(url, forKey: "test_relay_url")
        UserDefaults.standard.synchronize()
        print("Test relay URL set to: \(url)")
    }
    
    @objc public static func clearTestRelayUrl() {
        UserDefaults.standard.removeObject(forKey: "test_relay_url")
        UserDefaults.standard.synchronize()
        print("Test relay URL cleared")
    }
}
