import Foundation

public enum TerminalDisplayText {
    public static func normalize(_ output: String) -> String {
        var screen = Screen()
        var mainScreen = screen
        var alternateScreen = screen
        var isUsingAlternateScreen = false
        var index = output.startIndex

        while index < output.endIndex {
            let character = output[index]
            guard character == "\u{001B}" else {
                apply(character, to: &screen)
                index = output.index(after: index)
                continue
            }

            let next = output.index(after: index)
            guard next < output.endIndex else { break }
            switch output[next] {
            case "[":
                let control = consumeCSI(in: output, from: output.index(after: next))
                if control.isPrivate,
                   let parameter = control.parameters.first,
                   [47, 1047, 1049].contains(parameter),
                   control.final == "h" || control.final == "l" {
                    if control.final == "h", !isUsingAlternateScreen {
                        mainScreen = screen
                        alternateScreen = Screen()
                        screen = alternateScreen
                        isUsingAlternateScreen = true
                    } else if control.final == "l", isUsingAlternateScreen {
                        alternateScreen = screen
                        screen = mainScreen
                        isUsingAlternateScreen = false
                    }
                } else {
                    applyCSI(control, to: &screen)
                }
                index = control.next
            case "]":
                index = consumeOSC(in: output, from: output.index(after: next))
            case "(", ")":
                index = output.index(after: next)
            default:
                index = output.index(after: next)
            }
        }

        return screen.lines.map { String($0) }.joined(separator: "\n")
    }

    private struct Screen {
        var lines: [[Character]] = [[]]
        var row = 0
        var cursor = 0
    }

    private static func apply(_ character: Character, to screen: inout Screen) {
        switch character {
        case "\r":
            screen.cursor = 0
        case "\n", "\r\n":
            screen.row += 1
            ensureLine(&screen.lines, at: screen.row)
            screen.cursor = 0
        case "\u{0008}", "\u{007F}":
            screen.cursor = max(0, screen.cursor - 1)
        default:
            write(character, to: &screen.lines[screen.row], at: screen.cursor)
            screen.cursor += 1
        }
    }

    private static func write(_ character: Character, to line: inout [Character], at column: Int) {
        if column < line.count {
            line[column] = character
        } else {
            while line.count < column { line.append(" ") }
            line.append(character)
        }
    }

    private static func ensureLine(_ lines: inout [[Character]], at row: Int) {
        while lines.count <= row { lines.append([]) }
    }

    private static func applyCSI(_ control: CSIControl, to screen: inout Screen) {
        let first = control.parameters.first ?? 1
        switch control.final {
        case "A": screen.row = max(0, screen.row - first)
        case "B":
            screen.row += first
            ensureLine(&screen.lines, at: screen.row)
        case "C": screen.cursor += first
        case "D": screen.cursor = max(0, screen.cursor - first)
        case "G": screen.cursor = max(0, first - 1)
        case "H", "f":
            screen.row = max(0, (control.parameters.first ?? 1) - 1)
            screen.cursor = max(0, (control.parameters.dropFirst().first ?? 1) - 1)
            ensureLine(&screen.lines, at: screen.row)
        case "J":
            switch control.parameters.first ?? 0 {
            case 0:
                clearLine(&screen.lines[screen.row], from: screen.cursor)
                screen.lines.removeSubrange((screen.row + 1)...)
            case 1:
                if screen.row > 0 { screen.lines.removeSubrange(..<screen.row) }
                screen.row = 0
                clearLineThroughCursor(&screen.lines[screen.row], cursor: screen.cursor)
            case 2, 3:
                screen = Screen()
            default:
                break
            }
        case "K":
            let mode = control.parameters.first ?? 0
            switch mode {
            case 1:
                if !screen.lines[screen.row].isEmpty {
                    screen.lines[screen.row].removeSubrange(...min(screen.cursor, screen.lines[screen.row].count - 1))
                }
            case 2: screen.lines[screen.row].removeAll()
            default:
                if screen.cursor < screen.lines[screen.row].count { screen.lines[screen.row].removeSubrange(screen.cursor...) }
            }
        default: break
        }
    }

    private static func clearLine(_ line: inout [Character], from column: Int) {
        guard column < line.count else { return }
        line.removeSubrange(column...)
    }

    private static func clearLineThroughCursor(_ line: inout [Character], cursor: Int) {
        guard !line.isEmpty else { return }
        line.removeSubrange(...min(cursor, line.count - 1))
    }

    private struct CSIControl {
        let next: String.Index
        let final: Character?
        let parameters: [Int]
        let isPrivate: Bool
    }

    private static func consumeCSI(in output: String, from start: String.Index) -> CSIControl {
        var index = start
        var parameterText = ""
        while index < output.endIndex {
            let character = output[index]
            let scalar = character.unicodeScalars.first?.value ?? 0
            index = output.index(after: index)
            if (0x40...0x7E).contains(scalar) {
                let isPrivate = parameterText.hasPrefix("?")
                let parameters = parameterText
                    .trimmingCharacters(in: CharacterSet(charactersIn: "?"))
                    .split(separator: ";")
                    .compactMap { Int($0) }
                return CSIControl(next: index, final: character, parameters: parameters, isPrivate: isPrivate)
            }
            parameterText.append(character)
        }
        return CSIControl(next: index, final: nil, parameters: [], isPrivate: false)
    }

    private static func consumeOSC(in output: String, from start: String.Index) -> String.Index {
        var index = start
        while index < output.endIndex {
            if output[index] == "\u{0007}" { return output.index(after: index) }
            if output[index] == "\u{001B}" {
                let next = output.index(after: index)
                if next < output.endIndex, output[next] == "\\" {
                    return output.index(after: next)
                }
            }
            index = output.index(after: index)
        }
        return index
    }
}
