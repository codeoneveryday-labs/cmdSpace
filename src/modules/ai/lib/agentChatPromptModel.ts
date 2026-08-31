import type { AgentChatHistoryAttachment } from "./agentChatTimeline";

type ContextAttachment = { label: string; context: string };

export function appendVoiceTranscript(draft: string, transcript: string): string {
  const prefix = draft.trimEnd();
  return prefix ? `${prefix} ${transcript}` : transcript;
}

export function composeAgentChatPrompt({
  draft,
  attachments,
  historyAttachments,
}: {
  draft: string;
  attachments: ContextAttachment[];
  historyAttachments: AgentChatHistoryAttachment[];
}) {
  const prompt = draft.trim();
  const attachmentContext = attachments.length > 0
    ? `\n\nAttached context:\n${attachments
        .map((item) => `--- ${item.label} ---\n${item.context}`)
        .join("\n")}`
    : "";
  const historyContext = historyAttachments.length > 0
    ? `\n\nChat history attachment:\n${historyAttachments
        .map((attachment) => attachment.context)
        .join("\n\n")}`
    : "";
  const displayPrompt = prompt ||
    (attachments.length > 0
      ? "Please inspect the attached context."
      : "Continue from the attached conversation.");

  return {
    prompt,
    displayPrompt,
    composedPrompt: `${displayPrompt}${attachmentContext}${historyContext}`,
  };
}
