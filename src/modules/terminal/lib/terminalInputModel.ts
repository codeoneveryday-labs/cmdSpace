export type TerminalInputState = {
  hasPty: boolean;
  inputBuffer: string;
  inCommand: boolean;
  interactiveCodingAgent: boolean;
};

export function replaceUntouchedTerminalInput(
  state: TerminalInputState,
  expected: string,
  next: string,
  write: (data: string) => void,
): boolean {
  if (!state.hasPty || state.inCommand || state.inputBuffer !== expected) return false;
  if (expected.length > 0) write("\u0015");
  write(next);
  return true;
}

export function replaceCurrentTerminalInput(
  state: TerminalInputState,
  next: string,
  write: (data: string) => void,
): boolean {
  if (!state.hasPty || (state.inCommand && !state.interactiveCodingAgent)) return false;
  if (state.inputBuffer.length > 0) write("\u0015");
  write(next);
  return true;
}
