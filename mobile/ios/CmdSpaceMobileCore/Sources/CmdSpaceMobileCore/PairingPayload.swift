import Foundation

public enum PairingPayloadError: Error, Equatable {
    case invalidPayload
    case missingGrant
    case insecureEndpoint
}

public struct PairingPayload: Equatable {
    public let grantSecret: String
    public let webSocketURL: URL

    public init(grantSecret: String, webSocketURL: URL) {
        self.grantSecret = grantSecret
        self.webSocketURL = webSocketURL
    }

    public static func parse(_ value: String) throws -> PairingPayload {
        guard let components = URLComponents(string: value),
              components.scheme == "cmdspace",
              components.host == "device-pair",
              let endpoint = components.queryItems?.first(where: { $0.name == "url" })?.value,
              let grantSecret = components.queryItems?.first(where: { $0.name == "grant" })?.value,
              !grantSecret.isEmpty,
              var endpointComponents = URLComponents(string: endpoint)
        else {
            throw PairingPayloadError.invalidPayload
        }

        guard endpointComponents.scheme == "https" else {
            throw PairingPayloadError.insecureEndpoint
        }
        endpointComponents.scheme = "wss"
        endpointComponents.path = "/api/remote/device/ws"
        endpointComponents.query = nil
        guard let webSocketURL = endpointComponents.url else {
            throw PairingPayloadError.invalidPayload
        }
        return PairingPayload(grantSecret: grantSecret, webSocketURL: webSocketURL)
    }
}
