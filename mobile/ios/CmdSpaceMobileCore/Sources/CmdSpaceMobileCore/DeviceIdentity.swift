import CryptoKit
import Foundation
import Security

public final class DeviceIdentity {
    private static let account = "app.tranhoangpich.cmdspace.remote.device.identity"
    private let privateKey: Curve25519.Signing.PrivateKey

    private init(privateKey: Curve25519.Signing.PrivateKey) { self.privateKey = privateKey }

    public static func loadOrCreate() throws -> DeviceIdentity {
        if let stored = try load() { return DeviceIdentity(privateKey: stored) }
        let identity = DeviceIdentity(privateKey: .init())
        try identity.save()
        return identity
    }

    public var publicKey: String { privateKey.publicKey.rawRepresentation.base64URLEncodedString() }

    public var deviceId: String {
        SHA256.hash(data: privateKey.publicKey.rawRepresentation)
            .prefix(16)
            .map { String(format: "%02x", $0) }
            .joined()
    }

    public func signature(for text: String) throws -> String {
        try privateKey.signature(for: Data(text.utf8)).base64URLEncodedString()
    }

    private static func load() throws -> Curve25519.Signing.PrivateKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw KeychainError(status) }
        return try Curve25519.Signing.PrivateKey(rawRepresentation: data)
    }

    private func save() throws {
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Self.account,
            kSecValueData as String: privateKey.rawRepresentation,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError(status) }
    }
}

private struct KeychainError: Error { let status: OSStatus; init(_ status: OSStatus) { self.status = status } }

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
