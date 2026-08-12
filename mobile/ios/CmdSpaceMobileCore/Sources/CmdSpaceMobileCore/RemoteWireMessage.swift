import Foundation

public struct RemoteSession: Identifiable, Equatable {
    public let id: UInt64
    public let title: String
    public let cwd: String?
}

public enum RemoteWireMessage: Equatable {
    case pairingChallenge(String)
    case authenticated(String)
    case sessions([RemoteSession])
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
                return RemoteSession(id: id, title: title, cwd: session["cwd"] as? String)
            }
            return .sessions(sessions)
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
