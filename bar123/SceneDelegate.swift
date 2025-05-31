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
        
        let historyViewController = HistoryViewController()
        let navigationController = UINavigationController(rootViewController: historyViewController)
        
        window?.rootViewController = navigationController
        window?.makeKeyAndVisible()
    }

}
