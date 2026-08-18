import Foundation

/// A best-effort description of which program currently owns terminal input.
/// The remote protocol transports terminal bytes, not process metadata, so this
/// deliberately identifies only prompts that are visible in the transcript.
public enum TerminalInputMode: Equatable {
    case terminal
    case shell
    case codex

    public static func detect(in transcript: String) -> Self {
        let lines = transcript
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        let lastLine = lines.last(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })?
            .trimmingCharacters(in: .whitespaces) ?? ""

        if lastLine.hasSuffix("$") || lastLine.hasSuffix("%") || lastLine.hasSuffix("#") {
            return .shell
        }

        let recent = lines.suffix(12).joined(separator: "\n").lowercased()

        if recent.contains("gpt-")
            || recent.contains("what would you like to work on today")
            || recent.contains("›") {
            return .codex
        }

        return .terminal
    }
}
