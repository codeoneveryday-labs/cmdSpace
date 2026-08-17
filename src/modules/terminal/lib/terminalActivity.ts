export type TerminalActivity = {
  active: true;
  expiresAt: number;
};

export function noteTerminalOutput(now: number, quietWindowMs: number): TerminalActivity {
  return { active: true, expiresAt: now + quietWindowMs };
}
