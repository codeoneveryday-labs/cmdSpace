import Foundation

public struct RemoteSession: Identifiable, Equatable {
    public let id: UInt64
    public let title: String
    public let cwd: String?
    public let workspaceId: String?
}

public struct RemoteWorkspace: Identifiable, Codable, Equatable {
    public let id: String
    public let name: String
    public let workingFolder: String
}

public struct RemoteDirectoryEntry: Identifiable, Equatable {
    public let name: String
    public let path: String
    public let isDirectory: Bool
    public var id: String { path }
}

public struct RemoteImportableSession: Identifiable, Equatable {
    public let provider: String
    public let sessionId: String
    public let cwd: String
    public let title: String
    public let preview: String
    public let lastActivityAt: UInt64
    public let active: Bool
    public var id: String { "\(provider):\(sessionId)" }
}

public enum RemoteWireMessage: Equatable {
    case pairingChallenge(String)
    case authenticated(String)
    case snapshotRequired(sessionId: UInt64)
    case sessions([RemoteSession])
    case workspaces([RemoteWorkspace])
    case folderPickerDirectory(path: String, parent: String?, entries: [RemoteDirectoryEntry])
    case directory(path: String, entries: [RemoteDirectoryEntry])
    case fileContent(path: String, content: String)
    case importableSessions([RemoteImportableSession])
    case attached(sessionId: UInt64)
    case snapshot(sessionId: UInt64, sequence: UInt64, data: String)
    case output(sessionId: UInt64, sequence: UInt64, data: String)
    case exit(sessionId: UInt64)
    case error(code: String, message: String)
}

public enum RemoteWireMessageError: Error, Equatable { case malformed }

public extension RemoteWireMessage {
    static func decode(_ data: Data) throws -> RemoteWireMessage {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              root["version"] as? Int == 3,
              let message = root["message"] as? [String: Any],
              let type = message["type"] as? String
        else { throw RemoteWireMessageError.malformed }

        switch type {
        case "pairingChallenge":
            guard let challenge = message["challenge"] as? String else { throw RemoteWireMessageError.malformed }
            return .pairingChallenge(challenge)
        case "deviceAuthenticated":
            guard let deviceId = message["deviceId"] as? String else { throw RemoteWireMessageError.malformed }
            return .authenticated(deviceId)
        case "snapshotRequired":
            guard let sessionId = message["sessionId"] as? UInt64 else { throw RemoteWireMessageError.malformed }
            return .snapshotRequired(sessionId: sessionId)
        case "event":
            return try decodeEvent(message["event"] as? [String: Any])
        case "error":
            guard let code = message["code"] as? String, let text = message["message"] as? String else { throw RemoteWireMessageError.malformed }
            return .error(code: code, message: text)
        default:
            throw RemoteWireMessageError.malformed
        }
    }

    private static func decodeEvent(_ event: [String: Any]?) throws -> RemoteWireMessage {
        guard let event, let type = event["type"] as? String else { throw RemoteWireMessageError.malformed }
        switch type {
        case "sessions":
            let sessions = (event["sessions"] as? [[String: Any]] ?? []).compactMap { session -> RemoteSession? in
                guard let id = session["id"] as? UInt64, let title = session["title"] as? String else { return nil }
                return RemoteSession(
                    id: id,
                    title: title,
                    cwd: session["cwd"] as? String,
                    workspaceId: session["workspaceId"] as? String
                )
            }
            return .sessions(sessions)
        case "workspaces":
            let workspaces = (event["workspaces"] as? [[String: Any]] ?? []).compactMap { workspace -> RemoteWorkspace? in
                guard let id = workspace["id"] as? String,
                      let name = workspace["name"] as? String,
                      let workingFolder = workspace["workingFolder"] as? String
                else { return nil }
                return RemoteWorkspace(id: id, name: name, workingFolder: workingFolder)
            }
            return .workspaces(workspaces)
        case "directory":
            guard let path = event["path"] as? String else { throw RemoteWireMessageError.malformed }
            let entries = (event["entries"] as? [[String: Any]] ?? []).compactMap { entry -> RemoteDirectoryEntry? in
                guard let name = entry["name"] as? String, let path = entry["path"] as? String, let isDirectory = entry["isDirectory"] as? Bool else { return nil }
                return RemoteDirectoryEntry(name: name, path: path, isDirectory: isDirectory)
            }
            return .directory(path: path, entries: entries)
        case "folderPickerDirectory":
            guard let path = event["path"] as? String else { throw RemoteWireMessageError.malformed }
            let entries = (event["entries"] as? [[String: Any]] ?? []).compactMap { entry -> RemoteDirectoryEntry? in
                guard let name = entry["name"] as? String, let path = entry["path"] as? String, let isDirectory = entry["isDirectory"] as? Bool else { return nil }
                return RemoteDirectoryEntry(name: name, path: path, isDirectory: isDirectory)
            }
            return .folderPickerDirectory(path: path, parent: event["parent"] as? String, entries: entries)
        case "fileContent":
            guard let path = event["path"] as? String, let content = event["content"] as? String else { throw RemoteWireMessageError.malformed }
            return .fileContent(path: path, content: content)
        case "importableSessions":
            let sessions = (event["sessions"] as? [[String: Any]] ?? []).compactMap { session -> RemoteImportableSession? in
                guard let provider = session["provider"] as? String,
                      let sessionId = session["sessionId"] as? String,
                      let cwd = session["cwd"] as? String,
                      let title = session["title"] as? String
                else { return nil }
                return RemoteImportableSession(provider: provider, sessionId: sessionId, cwd: cwd, title: title, preview: session["preview"] as? String ?? "", lastActivityAt: session["lastActivityAt"] as? UInt64 ?? 0, active: session["active"] as? Bool ?? false)
            }
            return .importableSessions(sessions)
        case "attached":
            guard let id = event["sessionId"] as? UInt64 else { throw RemoteWireMessageError.malformed }
            return .attached(sessionId: id)
        case "snapshot", "output":
            guard let id = event["sessionId"] as? UInt64, let sequence = event["sequence"] as? UInt64, let data = event["data"] as? String else { throw RemoteWireMessageError.malformed }
            return type == "snapshot" ? .snapshot(sessionId: id, sequence: sequence, data: data) : .output(sessionId: id, sequence: sequence, data: data)
        case "exit":
            guard let id = event["sessionId"] as? UInt64 else { throw RemoteWireMessageError.malformed }
            return .exit(sessionId: id)
        default:
            throw RemoteWireMessageError.malformed
        }
    }
}
