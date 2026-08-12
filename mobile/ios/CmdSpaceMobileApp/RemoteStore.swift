import Foundation
import SwiftUI
import CmdSpaceMobileCore

@MainActor
final class RemoteStore: ObservableObject {
    enum State: Equatable { case unpaired, connecting, connected, failed(String) }

    @Published private(set) var state: State = .unpaired
    @Published private(set) var sessions: [RemoteSession] = []
    @Published private(set) var terminalText = ""
    @Published var activeSessionId: UInt64?
    @Published var pairingSheetOpen = false

    private var webSocket: URLSessionWebSocketTask?
    private var pairing: PairingPayload?
    private var identity: DeviceIdentity?
    private var lastSequence: [UInt64: UInt64] = [:]
    private var needsPairing = false

    var hasSavedDesktop: Bool { UserDefaults.standard.string(forKey: "cmdspace.remote.endpoint") != nil }

    func pair(from qrPayload: String) {
        do {
            pairing = try PairingPayload.parse(qrPayload)
            identity = try DeviceIdentity.loadOrCreate()
            needsPairing = true
            connect()
        } catch {
            state = .failed("Could not read this cmdSpace pairing code.")
        }
    }

    func connect() {
        guard let pairing, identity != nil else { state = .unpaired; return }
        state = .connecting
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = URLSession.shared.webSocketTask(with: pairing.webSocketURL)
        webSocket?.resume()
        receive()
        // The desktop sends a one-time challenge before accepting either pair
        // or reconnect credentials; nothing secret is retained from the QR.
    }

    func reconnectSavedDesktop() {
        guard let endpoint = UserDefaults.standard.string(forKey: "cmdspace.remote.endpoint"),
              let url = URL(string: endpoint),
              let identity = try? DeviceIdentity.loadOrCreate()
        else { return }
        pairing = PairingPayload(grantSecret: "", webSocketURL: url)
        self.identity = identity
        needsPairing = false
        connect()
    }

    func sendInput(_ text: String) {
        guard let sessionId = activeSessionId, !text.isEmpty else { return }
        send(.init(message: .command(.input(sessionId: sessionId, data: text))))
    }

    func attach(_ session: RemoteSession) {
        activeSessionId = session.id
        let after = lastSequence[session.id] ?? 0
        send(.init(message: .command(.attach(sessionId: session.id, after: after))))
    }

    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        state = .unpaired
    }

    private func receive() {
        webSocket?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case let .success(.string(text)):
                    self.handle(Data(text.utf8)); self.receive()
                case let .success(.data(data)):
                    self.handle(data); self.receive()
                case .success:
                    self.receive()
                case .failure:
                    self.state = .failed("Connection lost. Reconnect when the desktop is online.")
                }
            }
        }
    }

    private func handle(_ data: Data) {
        guard let message = try? RemoteWireMessage.decode(data) else { return }
        switch message {
        case let .pairingChallenge(challenge):
            guard let pairing, let identity else { return }
            if needsPairing, let pairingProof = try? identity.signature(for: pairing.grantSecret) {
                send(.pairDevice(grantSecret: pairing.grantSecret, deviceName: UIDevice.current.name, publicKey: identity.publicKey, proof: pairingProof))
            }
            if let authenticationProof = try? identity.signature(for: challenge) {
                send(.init(message: .authenticateDevice(deviceId: identity.deviceId, proof: authenticationProof)))
            }
        case let .authenticated(deviceId):
            state = .connected
            needsPairing = false
            send(.init(message: .command(.listSessions)))
            UserDefaults.standard.set(deviceId, forKey: "cmdspace.remote.device-id")
            UserDefaults.standard.set(pairing?.webSocketURL.absoluteString, forKey: "cmdspace.remote.endpoint")
        case let .sessions(next): sessions = next
        case let .snapshot(sessionId, sequence, text), let .output(sessionId, sequence, text):
            guard sequence > (lastSequence[sessionId] ?? 0) else { return }
            lastSequence[sessionId] = sequence
            if activeSessionId == nil || activeSessionId == sessionId { terminalText.append(text) }
        case .exit: break
        case let .error(_, text): state = .failed(text)
        }
    }

    private func send(_ envelope: DeviceEnvelope) {
        guard let data = try? envelope.encoded() else { return }
        webSocket?.send(.data(data)) { _ in }
    }
}
