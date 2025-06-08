/**
 * QRConnectionViewController.swift
 * Handles QR code-based P2P connection establishment
 * 
 * Features:
 * - QR code generation for connection offers
 * - QR code scanning for joining connections
 * - Manual text input/output for connection data
 * - Connection flow UI
 */

import UIKit
import AVFoundation
import CoreImage

class QRConnectionViewController: UIViewController {
    
    // MARK: - Properties
    weak var delegate: QRConnectionDelegate?
    private var connectionMode: ConnectionMode = .none
    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    // MARK: - UI Components
    private let titleLabel = UILabel()
    private let instructionLabel = UILabel()
    private let qrImageView = UIImageView()
    private let scannerView = UIView()
    private let connectionTextView = UITextView()
    private let actionButton = UIButton(type: .system)
    private let alternativeButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)
    
    // MARK: - Connection Mode
    enum ConnectionMode {
        case none
        case creatingOffer
        case showingOffer(String)
        case scanningOffer
        case showingAnswer(String)
        case scanningAnswer
        case processingConnection
    }
    
    // MARK: - View Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupConstraints()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopScanning()
    }
    
    // MARK: - Setup
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Title label
        titleLabel.font = .systemFont(ofSize: 24, weight: .semibold)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // Instruction label
        instructionLabel.font = .systemFont(ofSize: 16)
        instructionLabel.textAlignment = .center
        instructionLabel.numberOfLines = 0
        instructionLabel.textColor = .secondaryLabel
        instructionLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // QR image view
        qrImageView.contentMode = .scaleAspectFit
        qrImageView.layer.cornerRadius = 12
        qrImageView.layer.borderWidth = 2
        qrImageView.layer.borderColor = UIColor.systemGray4.cgColor
        qrImageView.translatesAutoresizingMaskIntoConstraints = false
        qrImageView.isHidden = true
        
        // Scanner view
        scannerView.layer.cornerRadius = 12
        scannerView.layer.borderWidth = 2
        scannerView.layer.borderColor = UIColor.systemGray4.cgColor
        scannerView.clipsToBounds = true
        scannerView.translatesAutoresizingMaskIntoConstraints = false
        scannerView.isHidden = true
        
        // Connection text view
        connectionTextView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        connectionTextView.layer.cornerRadius = 8
        connectionTextView.layer.borderWidth = 1
        connectionTextView.layer.borderColor = UIColor.systemGray4.cgColor
        connectionTextView.isEditable = false
        connectionTextView.translatesAutoresizingMaskIntoConstraints = false
        connectionTextView.isHidden = true
        
        // Action button
        actionButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .medium)
        actionButton.layer.cornerRadius = 12
        actionButton.backgroundColor = .systemBlue
        actionButton.setTitleColor(.white, for: .normal)
        actionButton.translatesAutoresizingMaskIntoConstraints = false
        actionButton.addTarget(self, action: #selector(actionButtonTapped), for: .touchUpInside)
        
        // Alternative button
        alternativeButton.titleLabel?.font = .systemFont(ofSize: 16)
        alternativeButton.translatesAutoresizingMaskIntoConstraints = false
        alternativeButton.addTarget(self, action: #selector(alternativeButtonTapped), for: .touchUpInside)
        
        // Cancel button
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 16)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelButtonTapped), for: .touchUpInside)
        
        // Add subviews
        view.addSubview(titleLabel)
        view.addSubview(instructionLabel)
        view.addSubview(qrImageView)
        view.addSubview(scannerView)
        view.addSubview(connectionTextView)
        view.addSubview(actionButton)
        view.addSubview(alternativeButton)
        view.addSubview(cancelButton)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Title
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 32),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            // Instruction
            instructionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            instructionLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            instructionLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            // QR Image View
            qrImageView.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 32),
            qrImageView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            qrImageView.widthAnchor.constraint(equalToConstant: 280),
            qrImageView.heightAnchor.constraint(equalToConstant: 280),
            
            // Scanner View
            scannerView.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 32),
            scannerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            scannerView.widthAnchor.constraint(equalToConstant: 280),
            scannerView.heightAnchor.constraint(equalToConstant: 280),
            
            // Connection Text View
            connectionTextView.topAnchor.constraint(equalTo: qrImageView.bottomAnchor, constant: 16),
            connectionTextView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            connectionTextView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            connectionTextView.heightAnchor.constraint(equalToConstant: 80),
            
            // Action Button
            actionButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            actionButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            actionButton.heightAnchor.constraint(equalToConstant: 56),
            actionButton.bottomAnchor.constraint(equalTo: alternativeButton.topAnchor, constant: -12),
            
            // Alternative Button
            alternativeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            alternativeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            alternativeButton.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -8),
            
            // Cancel Button
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            cancelButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])
    }
    
    // MARK: - Public Methods
    func startNewConnection() {
        updateUI(for: .creatingOffer)
        delegate?.qrConnectionControllerCreateOffer(self)
    }
    
    func joinExistingConnection() {
        updateUI(for: .scanningOffer)
        startScanning()
    }
    
    func showConnectionOffer(_ offer: String) {
        updateUI(for: .showingOffer(offer))
        displayQRCode(offer)
    }
    
    func showConnectionAnswer(_ answer: String) {
        updateUI(for: .showingAnswer(answer))
        displayQRCode(answer)
    }
    
    // MARK: - UI Updates
    private func updateUI(for mode: ConnectionMode) {
        connectionMode = mode
        
        switch mode {
        case .none:
            titleLabel.text = "P2P Connection"
            instructionLabel.text = "Choose how to connect"
            hideAllViews()
            
        case .creatingOffer:
            titleLabel.text = "Creating Connection"
            instructionLabel.text = "Generating connection offer..."
            hideAllViews()
            
        case .showingOffer(let offer):
            titleLabel.text = "Connection Offer"
            instructionLabel.text = "Show this QR code to another device"
            qrImageView.isHidden = false
            connectionTextView.isHidden = false
            connectionTextView.text = offer
            actionButton.setTitle("Scan Answer", for: .normal)
            actionButton.isHidden = false
            alternativeButton.setTitle("Copy to Clipboard", for: .normal)
            alternativeButton.isHidden = false
            
        case .scanningOffer:
            titleLabel.text = "Scan Connection"
            instructionLabel.text = "Scan the QR code from the other device"
            scannerView.isHidden = false
            actionButton.setTitle("Enter Manually", for: .normal)
            actionButton.isHidden = false
            alternativeButton.isHidden = true
            
        case .showingAnswer(let answer):
            titleLabel.text = "Connection Answer"
            instructionLabel.text = "Show this to the initiating device"
            qrImageView.isHidden = false
            connectionTextView.isHidden = false
            connectionTextView.text = answer
            actionButton.setTitle("Copy to Clipboard", for: .normal)
            actionButton.isHidden = false
            alternativeButton.isHidden = true
            
        case .scanningAnswer:
            titleLabel.text = "Scan Answer"
            instructionLabel.text = "Scan the answer QR code"
            scannerView.isHidden = false
            actionButton.setTitle("Enter Manually", for: .normal)
            actionButton.isHidden = false
            alternativeButton.isHidden = true
            
        case .processingConnection:
            titleLabel.text = "Connecting..."
            instructionLabel.text = "Establishing peer connection"
            hideAllViews()
        }
    }
    
    private func hideAllViews() {
        qrImageView.isHidden = true
        scannerView.isHidden = true
        connectionTextView.isHidden = true
        actionButton.isHidden = true
        alternativeButton.isHidden = true
    }
    
    // MARK: - QR Code
    private func displayQRCode(_ data: String) {
        let filter = CIFilter(name: "CIQRCodeGenerator")
        filter?.setValue(data.data(using: .utf8), forKey: "inputMessage")
        filter?.setValue("M", forKey: "inputCorrectionLevel")
        
        if let outputImage = filter?.outputImage {
            let scaleX = qrImageView.frame.size.width / outputImage.extent.size.width
            let scaleY = qrImageView.frame.size.height / outputImage.extent.size.height
            let scale = min(scaleX, scaleY)
            
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let scaledImage = outputImage.transformed(by: transform)
            
            qrImageView.image = UIImage(ciImage: scaledImage)
        }
    }
    
    // MARK: - QR Scanner
    private func startScanning() {
        guard let captureDevice = AVCaptureDevice.default(for: .video) else {
            showError("Camera not available")
            return
        }
        
        do {
            let input = try AVCaptureDeviceInput(device: captureDevice)
            
            captureSession = AVCaptureSession()
            captureSession?.addInput(input)
            
            let metadataOutput = AVCaptureMetadataOutput()
            captureSession?.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
            
            previewLayer = AVCaptureVideoPreviewLayer(session: captureSession!)
            previewLayer?.frame = scannerView.bounds
            previewLayer?.videoGravity = .resizeAspectFill
            scannerView.layer.addSublayer(previewLayer!)
            
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.captureSession?.startRunning()
            }
        } catch {
            showError("Failed to start camera: \(error.localizedDescription)")
        }
    }
    
    private func stopScanning() {
        captureSession?.stopRunning()
        previewLayer?.removeFromSuperlayer()
        captureSession = nil
        previewLayer = nil
    }
    
    // MARK: - Actions
    @objc private func actionButtonTapped() {
        switch connectionMode {
        case .showingOffer:
            // Scan answer
            stopScanning()
            updateUI(for: .scanningAnswer)
            startScanning()
            
        case .scanningOffer, .scanningAnswer:
            // Manual input
            showManualInputAlert()
            
        case .showingAnswer, .showingOffer:
            // Copy to clipboard
            UIPasteboard.general.string = connectionTextView.text
            showSuccess("Copied to clipboard")
            
        default:
            break
        }
    }
    
    @objc private func alternativeButtonTapped() {
        switch connectionMode {
        case .showingOffer:
            // Copy to clipboard
            UIPasteboard.general.string = connectionTextView.text
            showSuccess("Copied to clipboard")
            
        default:
            break
        }
    }
    
    @objc private func cancelButtonTapped() {
        stopScanning()
        dismiss(animated: true)
    }
    
    // MARK: - Manual Input
    private func showManualInputAlert() {
        let alert = UIAlertController(
            title: "Enter Connection Data",
            message: "Paste the connection data from the other device",
            preferredStyle: .alert
        )
        
        alert.addTextField { textField in
            textField.placeholder = "Connection data"
            textField.autocapitalizationType = .none
        }
        
        let processAction = UIAlertAction(title: "Process", style: .default) { [weak self] _ in
            guard let data = alert.textFields?.first?.text, !data.isEmpty else {
                self?.showError("Please enter connection data")
                return
            }
            self?.processScannedData(data)
        }
        
        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel)
        
        alert.addAction(processAction)
        alert.addAction(cancelAction)
        
        present(alert, animated: true)
    }
    
    // MARK: - Data Processing
    private func processScannedData(_ data: String) {
        switch connectionMode {
        case .scanningOffer:
            updateUI(for: .processingConnection)
            delegate?.qrConnectionController(self, didScanOffer: data)
            
        case .scanningAnswer:
            updateUI(for: .processingConnection)
            delegate?.qrConnectionController(self, didScanAnswer: data)
            
        default:
            break
        }
    }
    
    // MARK: - Helper Methods
    private func showError(_ message: String) {
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func showSuccess(_ message: String) {
        let alert = UIAlertController(title: "Success", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - AVCaptureMetadataOutputObjectsDelegate
extension QRConnectionViewController: AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let metadataObject = metadataObjects.first,
              let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
              let stringValue = readableObject.stringValue else { return }
        
        // Vibrate to indicate successful scan
        AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
        
        stopScanning()
        processScannedData(stringValue)
    }
}

// MARK: - QRConnectionDelegate Protocol
protocol QRConnectionDelegate: AnyObject {
    func qrConnectionControllerCreateOffer(_ controller: QRConnectionViewController)
    func qrConnectionController(_ controller: QRConnectionViewController, didScanOffer offer: String)
    func qrConnectionController(_ controller: QRConnectionViewController, didScanAnswer answer: String)
}