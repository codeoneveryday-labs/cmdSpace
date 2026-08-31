const ANSI_RE =
  /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][AB012]|\x1b[78=>]|\x1bc|\x1b[NOP\]X^_]/g;

export function tailTerminalLines(lines: readonly string[], maxLines: number): string {
  const tail = lines.slice(-maxLines);
  while (tail.length && tail[tail.length - 1] === "") tail.pop();
  return tail.join("\n");
}

export function tailTerminalSnapshot(snapshot: string, maxLines: number): string {
  return tailTerminalLines(snapshot.replace(ANSI_RE, "").split(/\r?\n/), maxLines);
}
