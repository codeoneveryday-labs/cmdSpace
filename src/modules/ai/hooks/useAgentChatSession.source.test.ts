import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "useAgentChatSession.ts",
);

describe("useAgentChatSession native session bootstrap", () => {
  it("auto-starts a native session without submitting a new prompt", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("runtimeSessionIdRef.current");
    expect(source).toContain("claimedNativeSessions");
    expect(source).toContain("input.chatId");
    expect(source).toContain("submitInFlightRef.current");
    expect(source).toContain("!input.active");
    expect(source).toContain('input.provider === "cmd"');
    expect(source).toContain('input.provider !== "codex" && input.provider !== "cmd"');
    expect(source).toContain("input.initialNativeSessionId");
    expect(source).toContain('prompt: ""');
    expect(source).toContain("nativeSessionId,");
  });

  it("hard-interrupts a stuck provider runtime and returns the timeline to idle", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("runtimeRef.current!.cancel(runtimeSessionId)");
    expect(source).toContain("runtimeRef.current!.close(runtimeSessionId)");
    expect(source).toContain("runtimeSessionId: null");
    expect(source).toContain('applyAgentChatEvent(current, { type: "done" })');
  });

  it("steers with a replacement prompt only after interrupting the active turn", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("const steer = useCallback");
    expect(source).toContain("await cancel();");
    expect(source).toContain("return submit(rawPrompt, model, displayText, attachments);");
  });

  it("drops stale events from an interrupted runtime before the next turn starts", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("runtimeEpochRef");
    expect(source).toContain("if (epoch !== runtimeEpochRef.current) return;");
    expect(source).toContain("runtimeEpochRef.current += 1;");
  });

  it("rewrites a session branch from an edited prompt instead of appending another user row", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("const rewriteFromPrompt = useCallback");
    expect(source).toContain("items: timelineRef.current.items.slice(0, itemIndex)");
    expect(source).toContain("const replayPrompt = buildAgentChatReplayPrompt(base, prompt);");
  });

});
