import { describe, expect, it } from "vitest";
import {
  applyAgentSignal,
  clearPtyLeaf,
  getLeafForPty,
  setAgentCliCommand,
  setAgentResponseActivity,
  setPtyLeaf,
  type AgentSignal,
} from "./agentActivity";

describe("agentActivity pty→leaf registry", () => {
  it("maps a pty id to a leaf id and clears it", () => {
    setPtyLeaf(7, 42);
    expect(getLeafForPty(7)).toBe(42);
    clearPtyLeaf(7);
    expect(getLeafForPty(7)).toBeUndefined();
  });
});

describe("applyAgentSignal", () => {
  const signal = (overrides: Partial<AgentSignal>): AgentSignal => ({
    id: 7,
    kind: "started",
    agent: "claude",
    ...overrides,
  });

  it("ignores signals for unknown pty ids", () => {
    clearPtyLeaf(7);
    // Should not throw and not crash on a stale signal.
    applyAgentSignal(signal({ kind: "exited" }));
  });

  it("started records the agent without marking the leaf responding", () => {
    setPtyLeaf(7, 42);
    applyAgentSignal(signal({ kind: "started", agent: "codex" }));
    setAgentCliCommand(42, "codex");
  });

  it("finished and exited clear responding", () => {
    setPtyLeaf(7, 42);
    setAgentResponseActivity(42, true);
    applyAgentSignal(signal({ kind: "finished" }));
    applyAgentSignal(signal({ kind: "exited", agent: null }));
    // exited also clears the pty→leaf mapping.
    expect(getLeafForPty(7)).toBeUndefined();
  });
});
