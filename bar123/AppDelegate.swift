//
//  AppDelegate.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit
import BackgroundTasks

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var torrentManager: TorrentManager?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Initialize torrent manager if shared secret exists
        if let sharedSecret = UserDefaults.standard.string(forKey: "bar123_shared_secret") {
            torrentManager = TorrentManager(sharedSecret: sharedSecret)
            torrentManager?.startSync()
            
            // Configure background sync
            BackgroundTaskManager.shared.configure(with: torrentManager!)
        }
        
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Notify background task manager
        BackgroundTaskManager.shared.applicationDidEnterBackground()
    }

}
