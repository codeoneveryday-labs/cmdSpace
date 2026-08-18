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

    func testPairingPayloadPrefersTheStableRelayEndpointWhenPresent() throws {
        let payload = try PairingPayload.parse(
            "cmdspace://device-pair?url=https%3A%2F%2Ftemporary.example.com&relay=https%3A%2F%2Fcmdspace-relay.example.workers.dev&relayId=desktop-relay-01&grant=one-time-secret"
        )

        XCTAssertEqual(payload.webSocketURL.absoluteString, "wss://cmdspace-relay.example.workers.dev/relay/desktop-relay-01")
        XCTAssertEqual(payload.relayId, "desktop-relay-01")
    }

    func testPairingPayloadRejectsRelayWithoutAnIdentifier() {
        XCTAssertThrowsError(
            try PairingPayload.parse(
                "cmdspace://device-pair?url=https%3A%2F%2Ftemporary.example.com&relay=https%3A%2F%2Fcmdspace-relay.example.workers.dev&grant=one-time-secret"
            )
        )
    }

    func testRelayControlMessageDoesNotUseTheNativeDeviceEnvelope() {
        XCTAssertEqual(
            RemoteRelayMessage.decode(Data("{\"type\":\"relayReady\"}".utf8)),
            .ready
        )
        XCTAssertEqual(
            RemoteRelayMessage.decode(Data("{\"type\":\"desktopOffline\"}".utf8)),
            .desktopOffline
        )
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

    func testWireMessageDecodesSnapshotRequiredForTheAffectedSession() throws {
        let payload = Data("""
        {"version":3,"message":{"type":"snapshotRequired","sessionId":42}}
        """.utf8)

        XCTAssertEqual(
            try RemoteWireMessage.decode(payload),
            .snapshotRequired(sessionId: 42)
        )
    }

    func testWireMessageDecodesTerminalAttachmentAcknowledgement() throws {
        let payload = Data("""
        {"version":3,"message":{"type":"event","event":{"type":"attached","sessionId":42}}}
        """.utf8)

        XCTAssertEqual(
            try RemoteWireMessage.decode(payload),
            .attached(sessionId: 42)
        )
    }

    func testDeviceEnvelopeEncodesTerminalResize() throws {
        let data = try DeviceEnvelope(message: .command(.resize(sessionId: 42, cols: 100, rows: 30))).encoded()
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let message = root["message"] as! [String: Any]
        let command = message["command"] as! [String: Any]

        XCTAssertEqual(command["type"] as? String, "resize")
        XCTAssertEqual(command["sessionId"] as? Int, 42)
        XCTAssertEqual(command["cols"] as? Int, 100)
        XCTAssertEqual(command["rows"] as? Int, 30)
    }

    func testDeviceEnvelopeEncodesCreateTerminal() throws {
        let data = try DeviceEnvelope(message: .command(.createSession(cwd: "/Users/boji/projects/cmdspace", workspaceId: "workspace-1"))).encoded()
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let message = root["message"] as! [String: Any]
        let command = message["command"] as! [String: Any]

        XCTAssertEqual(command["type"] as? String, "createSession")
        XCTAssertEqual(command["cwd"] as? String, "/Users/boji/projects/cmdspace")
        XCTAssertEqual(command["workspaceId"] as? String, "workspace-1")
    }

    func testDeviceEnvelopeEncodesTheDesktopFolderPickerCommand() throws {
        let data = try DeviceEnvelope(message: .command(.listFolderPickerDirectory(path: "/Users/boji/dev"))).encoded()
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let message = root["message"] as! [String: Any]
        let command = message["command"] as! [String: Any]

        XCTAssertEqual(command["type"] as? String, "listFolderPickerDirectory")
        XCTAssertEqual(command["path"] as? String, "/Users/boji/dev")
    }

    func testDeviceEnvelopeEncodesCreateWorkspaceWithItsInitialTerminals() throws {
        let data = try DeviceEnvelope(message: .command(.createWorkspace(
            workspaceId: "workspace-mobile-1",
            name: "cmdSpace",
            workingFolder: "/Users/boji/projects/cmdspace",
            terminalCount: 2
        ))).encoded()
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let message = root["message"] as! [String: Any]
        let command = message["command"] as! [String: Any]

        XCTAssertEqual(command["type"] as? String, "createWorkspace")
        XCTAssertEqual(command["workspaceId"] as? String, "workspace-mobile-1")
        XCTAssertEqual(command["name"] as? String, "cmdSpace")
        XCTAssertEqual(command["workingFolder"] as? String, "/Users/boji/projects/cmdspace")
        XCTAssertEqual(command["terminalCount"] as? Int, 2)
    }

    func testWireMessageDecodesRecentWorkspaces() throws {
        let payload = Data("""
        {"version":3,"message":{"type":"event","event":{"type":"workspaces","workspaces":[{"id":"zedra","name":"zedra","workingFolder":"/Users/boji/projects/zedra"}]}}}
        """.utf8)

        XCTAssertEqual(
            try RemoteWireMessage.decode(payload),
            .workspaces([RemoteWorkspace(id: "zedra", name: "zedra", workingFolder: "/Users/boji/projects/zedra")])
        )
    }

    func testTerminalDisplayTextRemovesAnsiAndShellIntegrationSequences() {
        let output = "\u{001B}[1mhello\u{001B}[0m\n\u{001B}]7;file:///Users/boji\u{0007}$ pwd\n/Users/boji"

        XCTAssertEqual(
            TerminalDisplayText.normalize(output),
            "hello\n$ pwd\n/Users/boji"
        )
    }

    func testTerminalDisplayTextAppliesCarriageReturnRedraws() {
        XCTAssertEqual(
            TerminalDisplayText.normalize("l\rls\r\nfile.txt\r\n"),
            "ls\nfile.txt\n"
        )
    }

    func testTerminalDisplayTextRewritesAnEarlierLineAfterCursorUp() {
        XCTAssertEqual(
            TerminalDisplayText.normalize("first\nsecond\n\u{001B}[2A\r\u{001B}[2Kupdated"),
            "updated\nsecond\n"
        )
    }

    func testTerminalDisplayTextClearsTheExistingScreenForCodexRedraw() {
        let output = "shell history\nold prompt\u{001B}[H\u{001B}[JCodex is ready"

        XCTAssertEqual(
            TerminalDisplayText.normalize(output),
            "Codex is ready"
        )
    }

    func testTerminalDisplayTextShowsOnlyTheAlternateScreenUsedByCodex() {
        let output = "shell history\n% ls\n\u{001B}[?1049hCodex is ready\n› hello"

        XCTAssertEqual(
            TerminalDisplayText.normalize(output),
            "Codex is ready\n› hello"
        )
    }

    func testTerminalInputModeExplainsWhenCodexOwnsTheTerminal() {
        XCTAssertEqual(
            TerminalInputMode.detect(in: "\n› ls\ngpt-5.6-terra medium · ~"),
            .codex
        )
        XCTAssertEqual(TerminalInputMode.detect(in: "boji@mac ~ % "), .shell)
    }

    func testTerminalCommandPayloadUsesCarriageReturnForEverySubmitSource() {
        XCTAssertEqual(TerminalCommandPayload.make(from: "hello"), "hello\r")
        XCTAssertNil(TerminalCommandPayload.make(from: ""))
    }
}
#endif
