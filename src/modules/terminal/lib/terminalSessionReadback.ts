import { tailTerminalLines, tailTerminalSnapshot } from "./terminalBufferModel";

type TerminalLine = { translateToString: (trimRight: boolean) => string } | undefined;
type TerminalBuffer = {
  length: number;
  getLine: (index: number) => TerminalLine;
};

export function readTerminalBuffer({
  buffer,
  snapshot,
  maxLines,
}: {
  buffer?: TerminalBuffer;
  snapshot: string | null;
  maxLines: number;
}): string {
  if (buffer) {
    const total = buffer.length;
    const lines: string[] = [];
    const start = Math.max(0, total - maxLines);
    for (let index = start; index < total; index += 1) {
      lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
    }
    return tailTerminalLines(lines, maxLines);
  }
  if (!snapshot) return "";
  return tailTerminalSnapshot(snapshot, maxLines);
}

export function readTerminalSelection(selection: string | null | undefined): string | null {
  const normalized = selection ?? "";
  return normalized.length > 0 ? normalized : null;
}
