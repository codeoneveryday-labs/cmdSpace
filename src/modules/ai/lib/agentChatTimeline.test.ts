import { describe, expect, it } from "vitest";
import {
  applyAgentChatEvent,
  createAgentChatTimeline,
  submitAgentChatPrompt,
  buildAgentChatReplayPrompt,
  sanitizeAgentChatText,
  buildAgentChatOutlineItems,
} from "./agentChatTimeline";

describe("agent chat timeline", () => {
  it("builds outline ticks only from prompts with real assistant responses", () => {
    const items = [
      { id: "u1", kind: "user" as const, text: "first" },
      { id: "a1", kind: "assistant" as const, text: "answer one" },
      { id: "u2", kind: "user" as const, text: "second" },
    ];
    expect(buildAgentChatOutlineItems(items)).toEqual([{ id: "u1", text: "first" }]);
    expect(buildAgentChatOutlineItems([...items, { id: "a2", kind: "assistant" as const, text: "answer two" }])).toEqual([
      { id: "u1", text: "first" },
      { id: "u2", text: "second" },
    ]);
  });
  it("replaces legacy binary attachment text instead of rendering gibberish", () => {
    expect(sanitizeAgentChatText("�\u0000�\u0001�\u0002")).toBe("[Image attachment omitted from legacy history]");
    expect(sanitizeAgentChatText("normal assistant response")).toBe("normal assistant response");
  });
  it("projects normalized runtime events into one provider-neutral timeline", () => {
    let state = submitAgentChatPrompt(createAgentChatTimeline("runtime-1"), "inspect repo");
    state = applyAgentChatEvent(state, { type: "session", nativeId: "thread-1" });
    state = applyAgentChatEvent(state, { type: "reasoning", text: "Looking" });
    state = applyAgentChatEvent(state, { type: "reasoning", text: " around" });
    state = applyAgentChatEvent(state, { type: "assistant", text: "Found" });
    state = applyAgentChatEvent(state, { type: "assistant", text: " it" });
    state = applyAgentChatEvent(state, {
      type: "tool",
      id: "tool-1",
      name: "rg workspace",
      status: "running",
      detail: null,
    });
    state = applyAgentChatEvent(state, {
      type: "tool",
      id: "tool-1",
      name: "rg workspace",
      status: "completed",
      detail: "2 matches",
    });
    state = applyAgentChatEvent(state, { type: "usage", inputTokens: 12, outputTokens: 7 });
    state = applyAgentChatEvent(state, { type: "done" });

    expect(state).toEqual({
      runtimeSessionId: "runtime-1",
      nativeSessionId: "thread-1",
      status: "idle",
      error: null,
      usage: { inputTokens: 12, outputTokens: 7 },
      items: [
        { id: "item-1", kind: "user", text: "inspect repo" },
        { id: "item-2", kind: "reasoning", text: "Looking around" },
        { id: "item-3", kind: "assistant", text: "Found it" },
        {
          id: "tool-1",
          kind: "tool",
          name: "rg workspace",
          status: "completed",
          detail: "2 matches",
        },
      ],
    });
  });

  it("keeps runtime errors visible until the next submission", () => {
    let state = applyAgentChatEvent(createAgentChatTimeline(null), {
      type: "error",
      message: "agent exited",
    });
    expect(state.status).toBe("error");
    expect(state.error).toBe("agent exited");

    state = submitAgentChatPrompt(state, "retry");
    expect(state.status).toBe("running");
    expect(state.error).toBeNull();
  });

  it("builds provider replay context only from user and assistant messages", () => {
    const state = {
      ...createAgentChatTimeline(null),
      items: [
        { id: "1", kind: "user" as const, text: "inspect" },
        { id: "2", kind: "reasoning" as const, text: "thinking" },
        { id: "3", kind: "assistant" as const, text: "found it" },
      ],
    };
    expect(buildAgentChatReplayPrompt(state, "fix it")).toBe(
      "Continue this coding-agent conversation in the same workspace.\n\nUser: inspect\n\nAssistant: found it\n\nUser: fix it",
    );
  });
});
