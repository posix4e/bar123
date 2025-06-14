//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit

class ViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Create stack view for vertical layout
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.alignment = .center
        stackView.spacing = 20
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        // Create app icon image view
        let iconImageView = UIImageView()
        iconImageView.image = UIImage(named: "Icon")
        iconImageView.contentMode = .scaleAspectFit
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        
        // Create info label
        let infoLabel = UILabel()
        infoLabel.text = "You can turn on bar123's Safari extension in Settings."
        infoLabel.textAlignment = .center
        infoLabel.numberOfLines = 0
        infoLabel.font = .systemFont(ofSize: 17)
        infoLabel.textColor = .label
        infoLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // Create open history button
        let openHistoryButton = UIButton(type: .system)
        openHistoryButton.setTitle("Open Full History", for: .normal)
        openHistoryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        openHistoryButton.backgroundColor = .systemBlue
        openHistoryButton.setTitleColor(.white, for: .normal)
        openHistoryButton.layer.cornerRadius = 8
        openHistoryButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 24, bottom: 12, right: 24)
        openHistoryButton.addTarget(self, action: #selector(openHistoryTapped), for: .touchUpInside)
        openHistoryButton.accessibilityIdentifier = "Open Full History"
        openHistoryButton.translatesAutoresizingMaskIntoConstraints = false
        
        // Add views to stack
        stackView.addArrangedSubview(iconImageView)
        stackView.addArrangedSubview(infoLabel)
        stackView.addArrangedSubview(openHistoryButton)
        
        // Add stack view to main view
        view.addSubview(stackView)
        
        // Set up constraints
        NSLayoutConstraint.activate([
            // Stack view constraints
            stackView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            stackView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
            
            // Icon constraints
            iconImageView.widthAnchor.constraint(equalToConstant: 128),
            iconImageView.heightAnchor.constraint(equalToConstant: 128),
            
            // Label constraints
            infoLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 300)
        ])
    }
    
    @objc private func openHistoryTapped() {
        // Open history view controller
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let historyVC = storyboard.instantiateViewController(withIdentifier: "HistoryViewController") as? HistoryViewController {
            let navController = UINavigationController(rootViewController: historyVC)
            navController.modalPresentationStyle = .fullScreen
            present(navController, animated: true)
        }
    }

}
