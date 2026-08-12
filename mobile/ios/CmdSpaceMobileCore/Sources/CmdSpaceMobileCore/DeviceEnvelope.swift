import Foundation

public struct DeviceEnvelope: Encodable {
    public let version = 3
    public let message: Message

    public init(message: Message) { self.message = message }

    public enum Message: Encodable {
        case pairDevice(grantSecret: String, deviceName: String, publicKey: String, proof: String)
        case authenticateDevice(deviceId: String, proof: String)
        case command(Command)
        case ping

        private enum CodingKeys: String, CodingKey {
            case type, grantSecret, deviceName, publicKey, proof, deviceId, command
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case let .pairDevice(grantSecret, deviceName, publicKey, proof):
                try container.encode("pairDevice", forKey: .type)
                try container.encode(grantSecret, forKey: .grantSecret)
                try container.encode(deviceName, forKey: .deviceName)
                try container.encode(publicKey, forKey: .publicKey)
                try container.encode(proof, forKey: .proof)
            case let .authenticateDevice(deviceId, proof):
                try container.encode("authenticateDevice", forKey: .type)
                try container.encode(deviceId, forKey: .deviceId)
                try container.encode(proof, forKey: .proof)
            case let .command(command):
                try container.encode("command", forKey: .type)
                try container.encode(command, forKey: .command)
            case .ping:
                try container.encode("ping", forKey: .type)
            }
        }
    }

    public enum Command: Encodable {
        case listSessions
        case attach(sessionId: UInt64, after: UInt64)
        case detach(sessionId: UInt64)
        case input(sessionId: UInt64, data: String)
        case resize(sessionId: UInt64, cols: UInt16, rows: UInt16)

        private enum CodingKeys: String, CodingKey { case type, sessionId, after, data, cols, rows }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .listSessions: try container.encode("listSessions", forKey: .type)
            case let .attach(sessionId, after):
                try container.encode("attach", forKey: .type); try container.encode(sessionId, forKey: .sessionId); try container.encode(after, forKey: .after)
            case let .detach(sessionId):
                try container.encode("detach", forKey: .type); try container.encode(sessionId, forKey: .sessionId)
            case let .input(sessionId, data):
                try container.encode("input", forKey: .type); try container.encode(sessionId, forKey: .sessionId); try container.encode(data, forKey: .data)
            case let .resize(sessionId, cols, rows):
                try container.encode("resize", forKey: .type); try container.encode(sessionId, forKey: .sessionId); try container.encode(cols, forKey: .cols); try container.encode(rows, forKey: .rows)
            }
        }
    }

    public static func pairDevice(grantSecret: String, deviceName: String, publicKey: String, proof: String) -> DeviceEnvelope {
        DeviceEnvelope(message: .pairDevice(grantSecret: grantSecret, deviceName: deviceName, publicKey: publicKey, proof: proof))
    }

    public func encoded() throws -> Data { try JSONEncoder().encode(self) }
}
