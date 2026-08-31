import type { Dispatch, SetStateAction } from "react";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { AgentAttachment } from "@/modules/ai/hooks/useAgentAttachments";
import { ChatHistoryCard } from "./AgentUserPrompt";

export function AgentComposerAttachments({
  attachments,
  historyAttachments,
  setAttachments,
  setHistoryAttachments,
}: {
  attachments: AgentAttachment[];
  historyAttachments: AgentChatHistoryAttachment[];
  setAttachments: Dispatch<SetStateAction<AgentAttachment[]>>;
  setHistoryAttachments: Dispatch<SetStateAction<AgentChatHistoryAttachment[]>>;
}) {
  return (
    <>
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((attachment, index) => (
            <button
              key={`${attachment.label}-${index}`}
              type="button"
              onClick={() =>
                setAttachments((current) => {
                  const removed = current[index];
                  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                  return current.filter((_, itemIndex) => itemIndex !== index);
                })
              }
              className="max-w-56 truncate rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              title="Remove attachment"
            >
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt="" className="mr-1.5 size-5 rounded object-cover" />
              ) : null}
              {attachment.label} ×
            </button>
          ))}
        </div>
      ) : null}
      {historyAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {historyAttachments.map((attachment, index) => (
            <button
              key={`${attachment.kind}-${index}`}
              type="button"
              onClick={() =>
                setHistoryAttachments((current) =>
                  current.filter((_, attachmentIndex) => attachmentIndex !== index),
                )
              }
              title="Remove chat history"
              className="rounded-lg"
            >
              <ChatHistoryCard attachment={attachment} />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
