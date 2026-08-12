import Foundation
import CmdSpaceMobileCore

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError(message) }
}

do {
    let payload = try PairingPayload.parse(
        "cmdspace://device-pair?url=https%3A%2F%2Fremote.example.com&grant=one-time-secret"
    )
    require(payload.grantSecret == "one-time-secret", "pairing grant was not decoded")
    require(
        payload.webSocketURL.absoluteString == "wss://remote.example.com/api/remote/device/ws",
        "pairing endpoint was not normalized to v3"
    )

    let encoded = try DeviceEnvelope.pairDevice(
        grantSecret: payload.grantSecret,
        deviceName: "cmdSpace iPhone",
        publicKey: "public-key",
        proof: "proof"
    ).encoded()
    let root = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
    let message = root["message"] as! [String: Any]
    require(root["version"] as? Int == 3, "device protocol version must be v3")
    require(message["type"] as? String == "pairDevice", "pair message type mismatch")
    require(message["grantSecret"] as? String == "one-time-secret", "grant secret field mismatch")
    print("CmdSpaceMobileCoreCheck: passed")
} catch {
    fatalError("CmdSpaceMobileCoreCheck failed: \(error)")
}
