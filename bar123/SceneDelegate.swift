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
        
        // Create window
        window = UIWindow(windowScene: windowScene)
        
        // Set the root view controller to our new MainViewController
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()
    }

}
