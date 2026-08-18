import Foundation
import SwiftUI
import CmdSpaceMobileCore

@MainActor
final class RemoteStore: ObservableObject {
    enum State: Equatable { case unpaired, connecting, connected, failed(String) }

    @Published private(set) var state: State = .unpaired
    @Published private(set) var sessions: [RemoteSession] = []
    @Published private(set) var recentWorkspaces: [RemoteWorkspace] = []
    @Published private(set) var directoryPath = ""
    @Published private(set) var directoryEntries: [RemoteDirectoryEntry] = []
    @Published private(set) var directoryLoading = false
    @Published private(set) var directoryError: String?
    @Published private(set) var folderPickerPath = ""
    @Published private(set) var folderPickerParent: String?
    @Published private(set) var folderPickerEntries: [RemoteDirectoryEntry] = []
    @Published private(set) var folderPickerLoading = false
    @Published private(set) var folderPickerError: String?
    @Published private(set) var importableSessions: [RemoteImportableSession] = []
    @Published private(set) var importSessionsLoading = false
    @Published private(set) var previewedFile: (path: String, content: String)?
    @Published private(set) var hasLoadedSessions = false
    @Published private(set) var terminalText = ""
    @Published private(set) var activeTerminalReady = false
    @Published private(set) var transientError: String?
    @Published var activeSessionId: UInt64?
    @Published var selectedWorkspace: RemoteWorkspace?
    @Published var pairingSheetOpen = false

    private var webSocket: URLSessionWebSocketTask?
    private var connectionTimeout: Task<Void, Never>?
    private var connectionGeneration = 0
    private var pairing: PairingPayload?
    private var identity: DeviceIdentity?
    private var lastSequence: [UInt64: UInt64] = [:]
    private var lastTerminalSize: [UInt64: (cols: UInt16, rows: UInt16)] = [:]
    private var needsPairing = false
    private var workspaceToOpenAfterPairingId: String?
    private var workspaceBeingCreatedId: String?
    private var creatingTerminal = false
    private var sessionIdsBeforeCreation = Set<UInt64>()
    private var needsActiveSessionReattachment = false

    var hasSavedDesktop: Bool { UserDefaults.standard.string(forKey: "cmdspace.remote.endpoint") != nil }
    var isConnected: Bool {
        if case .connected = state { return true }
        return false
    }

    init() {
        recentWorkspaces = Self.loadCachedWorkspaces()
    }

    func pair(from qrPayload: String, opening workspace: RemoteWorkspace? = nil) {
        do {
            pairing = try PairingPayload.parse(qrPayload)
            identity = try DeviceIdentity.loadOrCreate()
            needsPairing = true
            workspaceToOpenAfterPairingId = workspace?.id
            connect()
        } catch {
            state = .failed("Could not read this cmdSpace pairing code.")
        }
    }

    func connect() {
        guard let pairing, identity != nil else { state = .unpaired; return }
        connectionGeneration &+= 1
        let generation = connectionGeneration
        connectionTimeout?.cancel()
        state = .connecting
        webSocket?.cancel(with: .goingAway, reason: nil)
        let task = URLSession.shared.webSocketTask(with: pairing.webSocketURL)
        webSocket = task
        task.resume()
        if let relayId = pairing.relayId,
           let payload = try? JSONEncoder().encode(RemoteRelayAdmission(relayId: relayId)),
           let text = String(data: payload, encoding: .utf8) {
            task.send(.string(text)) { [weak self] error in
                if let error { Task { @MainActor in self?.connectionFailed(error.localizedDescription) } }
            }
        }
        receive(from: task, generation: generation)
        connectionTimeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(12))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard self?.connectionGeneration == generation,
                      case .connecting = self?.state
                else { return }
                self?.connectionFailed("The saved desktop did not respond. Connect it again with a new QR code.")
            }
        }
        // The desktop sends a one-time challenge before accepting either pair
        // or reconnect credentials; nothing secret is retained from the QR.
    }

    func reconnectSavedDesktop() {
        guard let endpoint = UserDefaults.standard.string(forKey: "cmdspace.remote.endpoint"),
              let url = URL(string: endpoint),
              let identity = try? DeviceIdentity.loadOrCreate()
        else { return }
        pairing = PairingPayload(
            grantSecret: "",
            webSocketURL: url,
            relayId: UserDefaults.standard.string(forKey: "cmdspace.remote.relay-id")
        )
        self.identity = identity
        needsPairing = false
        connect()
    }

    func sendInput(_ text: String) {
        guard let sessionId = activeSessionId, activeTerminalReady, !text.isEmpty else { return }
        send(.init(message: .command(.input(sessionId: sessionId, data: text))))
    }

    func sendKey(_ sequence: String) {
        sendInput(sequence)
    }

    func attach(_ session: RemoteSession) {
        if activeSessionId != session.id {
            terminalText = ""
        }
        activeSessionId = session.id
        activeTerminalReady = false
        needsActiveSessionReattachment = false
        lastTerminalSize[session.id] = nil
        let after = lastSequence[session.id] ?? 0
        send(.init(message: .command(.attach(sessionId: session.id, after: after))))
    }

    func refreshSessions() {
        send(.init(message: .command(.listSessions)))
    }

    func refreshWorkspaces() {
        send(.init(message: .command(.listWorkspaces)))
    }

    func refreshImportableSessions(workspace: RemoteWorkspace, workspaceOnly: Bool) {
        importSessionsLoading = true
        send(.init(message: .command(.listImportableSessions(workspaceId: workspace.id, workspaceOnly: workspaceOnly))))
    }

    func importSessions(_ ids: [String]) {
        guard let workspace = selectedWorkspace else { return }
        for id in ids {
            guard let session = importableSessions.first(where: { $0.id == id }), !session.active else { continue }
            send(.init(message: .command(.importSession(workspaceId: workspace.id, provider: session.provider, sessionId: session.sessionId))))
        }
    }

    func browseDirectory(workspace: RemoteWorkspace, path: String? = nil) {
        directoryEntries = []
        directoryLoading = true
        directoryError = nil
        send(.init(message: .command(.listDirectory(workspaceId: workspace.id, path: path))))
    }

    func browseFolderPicker(path: String? = nil) {
        folderPickerEntries = []
        folderPickerLoading = true
        folderPickerError = nil
        send(.init(message: .command(.listFolderPickerDirectory(path: path))))
    }

    func previewFile(workspace: RemoteWorkspace, path: String) {
        previewedFile = nil
        send(.init(message: .command(.readFile(workspaceId: workspace.id, path: path))))
    }

    func createDirectory(workspace: RemoteWorkspace, parent: String, name: String) {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        send(.init(message: .command(.createDirectory(workspaceId: workspace.id, path: parent, name: name))))
    }

    func openWorkspace(_ workspace: RemoteWorkspace) {
        selectedWorkspace = workspace
        if let session = sessions.first(where: { $0.workspaceId == workspace.id }) {
            attach(session)
        }
    }

    func closeWorkspace() {
        selectedWorkspace = nil
        activeSessionId = nil
        activeTerminalReady = false
        terminalText = ""
    }

    func createTerminal() {
        guard hasLoadedSessions, !creatingTerminal, let workspace = selectedWorkspace else { return }
        creatingTerminal = true
        sessionIdsBeforeCreation = Set(sessions.map(\.id))
        send(.init(message: .command(.createSession(cwd: workspace.workingFolder, workspaceId: workspace.id))))
    }

    func createWorkspace(name: String, workingFolder: String, terminalCount: Int) {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedFolder = workingFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isConnected, !trimmedName.isEmpty, !trimmedFolder.isEmpty else { return }
        let workspaceId = "workspace-mobile-\(UUID().uuidString.lowercased())"
        workspaceBeingCreatedId = workspaceId
        send(.init(message: .command(.createWorkspace(
            workspaceId: workspaceId,
            name: trimmedName,
            workingFolder: trimmedFolder,
            terminalCount: min(max(terminalCount, 1), 12)
        ))))
    }

    func resizeActiveTerminal(cols: UInt16, rows: UInt16) {
        guard let sessionId = activeSessionId, cols > 0, rows > 0 else { return }
        if let lastSize = lastTerminalSize[sessionId], lastSize.cols == cols, lastSize.rows == rows {
            return
        }
        lastTerminalSize[sessionId] = (cols, rows)
        send(.init(message: .command(.resize(sessionId: sessionId, cols: cols, rows: rows))))
    }

    func dismissTransientError() {
        transientError = nil
    }

    func disconnect() {
        connectionGeneration &+= 1
        connectionTimeout?.cancel()
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        sessions = []
        hasLoadedSessions = false
        activeSessionId = nil
        activeTerminalReady = false
        state = .unpaired
    }

    private func receive(from task: URLSessionWebSocketTask, generation: Int) {
        task.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                guard self.connectionGeneration == generation, self.webSocket === task else { return }
                switch result {
                case let .success(.string(text)):
                    self.handle(Data(text.utf8))
                    self.receive(from: task, generation: generation)
                case let .success(.data(data)):
                    self.handle(data)
                    self.receive(from: task, generation: generation)
                case .success:
                    self.receive(from: task, generation: generation)
                case let .failure(error):
                    self.connectionFailed(self.connectionMessage(for: error))
                }
            }
        }
    }

    private func handle(_ data: Data) {
        if let relayMessage = RemoteRelayMessage.decode(data) {
            if relayMessage == .desktopOffline {
                connectionFailed("Your desktop is offline. Open cmdSpace on the desktop, then try again.")
            }
            return
        }
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
            connectionTimeout?.cancel()
            state = .connected
            needsPairing = false
            hasLoadedSessions = false
            activeTerminalReady = false
            needsActiveSessionReattachment = activeSessionId != nil
            if activeSessionId == nil {
                terminalText = ""
            }
            UserDefaults.standard.set(deviceId, forKey: "cmdspace.remote.device-id")
            UserDefaults.standard.set(pairing?.webSocketURL.absoluteString, forKey: "cmdspace.remote.endpoint")
            if let relayId = pairing?.relayId {
                UserDefaults.standard.set(relayId, forKey: "cmdspace.remote.relay-id")
            } else {
                UserDefaults.standard.removeObject(forKey: "cmdspace.remote.relay-id")
            }
            recentWorkspaces = Self.loadCachedWorkspaces(for: deviceId)
            refreshSessions()
            refreshWorkspaces()
        case let .snapshotRequired(sessionId):
            lastSequence[sessionId] = nil
            lastTerminalSize[sessionId] = nil
            guard activeSessionId == sessionId else { return }
            terminalText = ""
            send(.init(message: .command(.attach(sessionId: sessionId, after: 0))))
        case let .sessions(next):
            sessions = next
            hasLoadedSessions = true
            if activeSessionId == nil,
               let workspace = selectedWorkspace,
               let session = next.first(where: { $0.workspaceId == workspace.id }) {
                attach(session)
            }
            if let activeSessionId {
                if let session = next.first(where: { $0.id == activeSessionId }) {
                    if needsActiveSessionReattachment {
                        needsActiveSessionReattachment = false
                        attach(session)
                    }
                } else {
                    self.activeSessionId = nil
                    activeTerminalReady = false
                    needsActiveSessionReattachment = false
                    terminalText = ""
                }
            }
            if creatingTerminal,
               let newest = next.filter({ !sessionIdsBeforeCreation.contains($0.id) }).max(by: { $0.id < $1.id }) {
                creatingTerminal = false
                attach(newest)
            }
        case let .workspaces(next):
            recentWorkspaces = next
            Self.cacheWorkspaces(next, for: UserDefaults.standard.string(forKey: "cmdspace.remote.device-id"))
            if let workspaceId = workspaceBeingCreatedId,
               let workspace = next.first(where: { $0.id == workspaceId }) {
                workspaceBeingCreatedId = nil
                selectedWorkspace = workspace
            }
            if let workspaceId = workspaceToOpenAfterPairingId,
               let workspace = next.first(where: { $0.id == workspaceId }) {
                workspaceToOpenAfterPairingId = nil
                openWorkspace(workspace)
            }
        case let .directory(path, entries):
            directoryPath = path
            directoryEntries = entries
            directoryLoading = false
        case let .folderPickerDirectory(path, parent, entries):
            folderPickerPath = path
            folderPickerParent = parent
            folderPickerEntries = entries
            folderPickerLoading = false
        case let .fileContent(path, content):
            previewedFile = (path, content)
        case let .importableSessions(next):
            importableSessions = next
            importSessionsLoading = false
        case let .attached(sessionId):
            guard activeSessionId == sessionId else { return }
            activeTerminalReady = true
            lastTerminalSize[sessionId] = nil
        case let .snapshot(sessionId, sequence, text), let .output(sessionId, sequence, text):
            guard sequence > (lastSequence[sessionId] ?? 0) else { return }
            lastSequence[sessionId] = sequence
            if activeSessionId == nil || activeSessionId == sessionId { terminalText.append(text) }
        case .exit: break
        case let .error(_, text):
            creatingTerminal = false
            importSessionsLoading = false
            if directoryLoading { directoryLoading = false; directoryError = text; return }
            if folderPickerLoading { folderPickerLoading = false; folderPickerError = text; return }
            if workspaceBeingCreatedId != nil {
                workspaceBeingCreatedId = nil
                reportTransientFailure(text)
                return
            }
            if text.hasPrefix("attach this terminal before"),
               let session = sessions.first(where: { $0.id == activeSessionId }) {
                attach(session)
            } else if case .connecting = state {
                state = .failed(text)
            } else {
                reportTransientFailure(text)
            }
        }
    }

    func cancelConnection() {
        guard case .connecting = state else { return }
        connectionGeneration &+= 1
        connectionTimeout?.cancel()
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        state = .unpaired
    }

    private func connectionFailed(_ message: String) {
        connectionGeneration &+= 1
        connectionTimeout?.cancel()
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        state = .failed(message)
    }

    private func reportTransientFailure(_ message: String) {
        transientError = message
    }

    private func connectionMessage(for error: Error) -> String {
        let urlError = error as NSError
        if urlError.domain == NSURLErrorDomain,
           urlError.code == NSURLErrorBadServerResponse {
            return "This desktop connection has expired. Connect it again with a new QR code."
        }
        return "Your desktop is unavailable right now. Try again or connect it again with a new QR code."
    }

    private func send(_ envelope: DeviceEnvelope) {
        guard let data = try? envelope.encoded(), let text = String(data: data, encoding: .utf8) else { return }
        webSocket?.send(.string(text)) { _ in }
    }

    private static func cachedWorkspacesKey(for deviceId: String? = nil) -> String {
        let device = deviceId ?? UserDefaults.standard.string(forKey: "cmdspace.remote.device-id") ?? "unpaired"
        return "cmdspace.remote.mobile-workspaces.\(device)"
    }

    private static func loadCachedWorkspaces(for deviceId: String? = nil) -> [RemoteWorkspace] {
        guard let data = UserDefaults.standard.data(forKey: cachedWorkspacesKey(for: deviceId)),
              let workspaces = try? JSONDecoder().decode([RemoteWorkspace].self, from: data)
        else { return [] }
        return workspaces
    }

    private static func cacheWorkspaces(_ workspaces: [RemoteWorkspace], for deviceId: String?) {
        guard let data = try? JSONEncoder().encode(workspaces) else { return }
        UserDefaults.standard.set(data, forKey: cachedWorkspacesKey(for: deviceId))
    }
}
