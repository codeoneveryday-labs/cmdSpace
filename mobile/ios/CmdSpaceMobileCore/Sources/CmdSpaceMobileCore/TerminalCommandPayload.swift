import Foundation

public enum TerminalCommandPayload {
    public static func make(from command: String) -> String? {
        guard !command.isEmpty else { return nil }
        return command + "\r"
    }
}
