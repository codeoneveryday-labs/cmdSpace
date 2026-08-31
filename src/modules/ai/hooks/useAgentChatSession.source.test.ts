import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "useAgentChatSession.ts",
);

describe("useAgentChatSession native session bootstrap", () => {
  it("only attempts a resident attach before the first prompt", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("runtimeSessionIdRef.current");
    expect(source).toContain("createAgentChatStartup");
    expect(source).toContain(".attachResident()");
    expect(source).toContain(".admitFirstPrompt(runtimePrompt, model)");
    expect(source).toContain("claimedNativeSessions");
    expect(source).toContain("input.chatId");
    expect(source).toContain("chatId: input.chatId");
    expect(source).toContain("submitInFlightRef.current");
    expect(source).toContain("!input.active");
    expect(source).toContain('input.provider !== "codex" && input.provider !== "cmd"');
    expect(source).toContain("input.initialNativeSessionId");
    expect(source).not.toContain('prompt: ""');
  });

  it("interrupts the active turn while keeping the resident runtime attached", () => {
    const source = readFileSync(sourcePath, "utf8");

    const cancelBlock = source.slice(
      source.indexOf("const cancel = useCallback"),
      source.indexOf("const steer = useCallback"),
    );
    expect(cancelBlock).toContain("runtimeRef.current!.cancel(runtimeSessionId)");
    expect(cancelBlock).toContain('applyAgentChatEvent(current, { type: "done" })');
    expect(cancelBlock).not.toContain(".close(");
    expect(cancelBlock).not.toContain("runtimeEpochRef.current += 1");
    expect(source).toContain("const attachmentRef = useRef");
    expect(source).toContain("runtime.detach(input.chatId, result.sessionId, result.attachmentToken)");
    expect(source).toContain("attachment.sessionId");
    expect(source).toContain("attachment.attachmentToken");
    expect(source).toContain(".attachResident()");
  });

  it("steers by waiting for the post-interrupt Done before reusing the runtime", () => {
    const source = readFileSync(sourcePath, "utf8");

    const steerBlock = source.slice(
      source.indexOf("const steer = useCallback"),
      source.indexOf("const rewriteFromPrompt = useCallback"),
    );
    expect(steerBlock).toContain("doneWaiterRef");
    expect(steerBlock).toContain("Promise.race");
    expect(steerBlock).toContain("submit(pending.rawPrompt, pending.model");
  });

  it("fully resets the runtime when rewriting a session branch", () => {
    const source = readFileSync(sourcePath, "utf8");

    const rewriteBlock = source.slice(
      source.indexOf("const rewriteFromPrompt = useCallback"),
      source.indexOf("useEffect(() => {\n    return () => {"),
    );
    expect(rewriteBlock).toContain("runtimeRef.current!.close(runtimeSessionId)");
    expect(rewriteBlock).toContain("runtimeEpochRef.current += 1");
    expect(rewriteBlock).toContain("startupRef.current = null");
    expect(rewriteBlock).toContain("runtimeSessionId: null");
  });

  it("drops stale events from an interrupted runtime before the next turn starts", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("runtimeEpochRef");
    expect(source).toContain("if (epoch !== runtimeEpochRef.current) return;");
    expect(source).toContain("runtimeEpochRef.current += 1;");
  });

  it("re-admits the current prompt when its cached runtime has already exited", () => {
    const source = readFileSync(sourcePath, "utf8");

    const submitBlock = source.slice(
      source.indexOf("const submit = useCallback"),
      source.indexOf("const cancel = useCallback"),
    );
    expect(submitBlock).toContain("isMissingAgentChatRuntime");
    expect(submitBlock).toContain("runtimeSessionIdRef.current = null");
    expect(submitBlock).toContain(".recoverFirstPrompt(runtimePrompt, model)");
  });

  it("owns attachment identity only for runtime cleanup", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("const attachmentRef = useRef");
    expect(source).toContain("attachmentRef.current = {");
    expect(source).toContain("attachmentRef.current = null");
    expect(source).toContain("attachment.attachmentToken");
  });

  it("rewrites a session branch from an edited prompt instead of appending another user row", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("const rewriteFromPrompt = useCallback");
    expect(source).toContain("items: timelineRef.current.items.slice(0, itemIndex)");
    expect(source).toContain("const replayPrompt = buildAgentChatReplayPrompt(base, prompt);");
  });

});
