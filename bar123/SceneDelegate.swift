//
//  SceneDelegate.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        window = UIWindow(windowScene: windowScene)
        
        // Setup initial view controller
        let mainVC = ViewController()
        let navController = UINavigationController(rootViewController: mainVC)
        
        window?.rootViewController = navController
        window?.makeKeyAndVisible()
        
        // Listen for history view notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(openHistoryView),
            name: NSNotification.Name("OpenHistoryView"),
            object: nil
        )
        
        // Check if we should open history view from URL
        if let urlContext = connectionOptions.urlContexts.first {
            handleURL(urlContext.url)
        }
    }
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            handleURL(url)
        }
    }
    
    private func handleURL(_ url: URL) {
        if url.absoluteString.contains("history") {
            openHistoryView()
        }
    }
    
    @objc private func openHistoryView() {
        DispatchQueue.main.async {
            let historyVC = HistoryViewController()
            let navController = UINavigationController(rootViewController: historyVC)
            navController.modalPresentationStyle = .fullScreen
            
            self.window?.rootViewController?.present(navController, animated: true)
        }
    }
}