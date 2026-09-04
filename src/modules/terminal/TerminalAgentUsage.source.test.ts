import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./TerminalAgentUsage.tsx", import.meta.url), "utf8");

describe("TerminalAgentUsage contract", () => {
  it("owns optional usage polling and presentation", () => {
    expect(source).toContain("useTerminalAgentUsage");
    expect(source).toContain("getAgentUsageStatuses");
    expect(source).toContain("AgentUsageMenu");
    expect(source).toContain("window.clearInterval");
    expect(source).toContain("nativeSessionProvider === cliAgent");
    expect(source).toContain("sessionStartedAtMs");
    expect(source).toContain("agentState,");
    expect(source).toContain("agentCommand,\n    agentState,");
  });

  it("supports native session ids from resumed CLI commands", async () => {
    const { extractNativeSessionId } = await import("./TerminalAgentUsage");

    expect(extractNativeSessionId("cmd --resume 12345678-1234-1234-1234-123456789abc", "cmd"))
      .toBe("12345678-1234-1234-1234-123456789abc");
    expect(extractNativeSessionId("opencode -s ses_abc123", "opencode"))
      .toBe("ses_abc123");
    expect(
      extractNativeSessionId(
        "cmd --session '/Users/me/.commandcode/projects/repo/8201df8d-d8d8-4c2c-9656-6e89fc20a6ac.jsonl'",
        "cmd",
      ),
    ).toBe("8201df8d-d8d8-4c2c-9656-6e89fc20a6ac");
    expect(extractNativeSessionId("cmd --resume named-session", "cmd")).toBeNull();
  });
});
