import { describe, expect, it } from "vitest";
import {
  appendVoiceTranscript,
  composeAgentChatPrompt,
} from "./agentChatPromptModel";

describe("agentChatPromptModel", () => {
  it("combines draft, file context and history in stable order", () => {
    expect(
      composeAgentChatPrompt({
        draft: "  review this  ",
        attachments: [{ label: "README.md", context: "docs" }],
        historyAttachments: [
          {
            kind: "chat-history",
            title: "Chat history",
            subtitle: "Previous conversation",
            context: "prior",
          },
        ],
      }),
    ).toEqual({
      prompt: "review this",
      displayPrompt: "review this",
      composedPrompt:
        "review this\n\nAttached context:\n--- README.md ---\ndocs\n\nChat history attachment:\nprior",
    });
  });

  it("uses attachment-specific fallback text when draft is empty", () => {
    expect(
      composeAgentChatPrompt({
        draft: "",
        attachments: [{ label: "file.ts", context: "code" }],
        historyAttachments: [],
      }).displayPrompt,
    ).toBe("Please inspect the attached context.");
  });

  it("appends a voice transcript after meaningful draft text without preserving trailing space", () => {
    expect(appendVoiceTranscript("Review this   ", "and summarize it")).toBe(
      "Review this and summarize it",
    );
  });

  it("uses the voice transcript as the draft when the current draft is blank", () => {
    expect(appendVoiceTranscript("  ", "open the terminal")).toBe(
      "open the terminal",
    );
  });
});
