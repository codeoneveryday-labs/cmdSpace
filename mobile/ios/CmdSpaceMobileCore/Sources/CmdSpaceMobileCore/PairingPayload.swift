import Foundation

public enum PairingPayloadError: Error, Equatable {
    case invalidPayload
    case missingGrant
    case insecureEndpoint
}

public struct PairingPayload: Equatable {
    public let grantSecret: String
    public let webSocketURL: URL
    public let relayId: String?

    public init(grantSecret: String, webSocketURL: URL, relayId: String? = nil) {
        self.grantSecret = grantSecret
        self.webSocketURL = webSocketURL
        self.relayId = relayId
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

        let relay = components.queryItems?.first(where: { $0.name == "relay" })?.value
        let relayId = components.queryItems?.first(where: { $0.name == "relayId" })?.value
        if relay != nil || relayId != nil {
            guard let relay,
                  let relayId,
                  !relayId.isEmpty,
                  relayId.unicodeScalars.allSatisfy({
                      CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
                          .contains($0)
                  }),
                  var relayComponents = URLComponents(string: relay),
                  relayComponents.scheme == "https",
                  relayComponents.host != nil
            else {
                throw PairingPayloadError.invalidPayload
            }
            relayComponents.scheme = "wss"
            relayComponents.path = "/relay/\(relayId)"
            relayComponents.query = nil
            guard let relayWebSocketURL = relayComponents.url else {
                throw PairingPayloadError.invalidPayload
            }
            return PairingPayload(
                grantSecret: grantSecret,
                webSocketURL: relayWebSocketURL,
                relayId: relayId
            )
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
