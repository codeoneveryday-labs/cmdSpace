import Foundation

public enum RemoteRelayMessage: Equatable {
    case ready
    case desktopOffline

    public static func decode(_ data: Data) -> RemoteRelayMessage? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = root["type"] as? String
        else { return nil }
        switch type {
        case "relayReady": return .ready
        case "desktopOffline": return .desktopOffline
        default: return nil
        }
    }
}

public struct RemoteRelayAdmission: Encodable {
    public let version = 1
    public let role = "device"
    public let relayId: String
    public let credential = ""

    public init(relayId: String) {
        self.relayId = relayId
    }
}
