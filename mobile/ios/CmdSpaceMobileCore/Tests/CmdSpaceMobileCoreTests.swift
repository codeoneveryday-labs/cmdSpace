#if canImport(XCTest)
import XCTest
@testable import CmdSpaceMobileCore

final class CmdSpaceMobileCoreTests: XCTestCase {
    func testPairingPayloadParsesCmdSpaceQrAndNormalizesTheDeviceEndpoint() throws {
        let payload = try PairingPayload.parse(
            "cmdspace://device-pair?url=https%3A%2F%2Fremote.example.com&grant=one-time-secret"
        )

        XCTAssertEqual(payload.grantSecret, "one-time-secret")
        XCTAssertEqual(payload.webSocketURL.absoluteString, "wss://remote.example.com/api/remote/device/ws")
    }

    func testPairingPayloadRejectsAWebSocketEndpointWithoutTls() {
        XCTAssertThrowsError(
            try PairingPayload.parse(
                "cmdspace://device-pair?url=http%3A%2F%2F192.168.1.4&grant=one-time-secret"
            )
        )
    }

    func testDeviceEnvelopeUsesProtocolV3AndCamelCaseFields() throws {
        let data = try DeviceEnvelope.pairDevice(
            grantSecret: "grant",
            deviceName: "Boji's iPhone",
            publicKey: "public-key",
            proof: "proof"
        ).encoded()
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let message = json["message"] as! [String: Any]

        XCTAssertEqual(json["version"] as? Int, 3)
        XCTAssertEqual(message["type"] as? String, "pairDevice")
        XCTAssertEqual(message["grantSecret"] as? String, "grant")
        XCTAssertEqual(message["deviceName"] as? String, "Boji's iPhone")
    }
}
#endif
