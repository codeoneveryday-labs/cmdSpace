import SwiftUI
import VisionKit

@available(iOS 16.0, *)
struct QRCodeScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void
    let onUnavailable: () -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        do { try scanner.startScanning() } catch { onUnavailable() }
        return scanner
    }

    func updateUIViewController(_: DataScannerViewController, context _: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }
        func dataScanner(_: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems _: [RecognizedItem]) {
            guard case let .barcode(barcode) = addedItems.first, let payload = barcode.payloadStringValue else { return }
            onScan(payload)
        }
    }
}
