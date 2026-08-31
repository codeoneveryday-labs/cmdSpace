import { useState } from "react";
import { AiChat01Icon, Copy01Icon, Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AgentChatHistoryAttachment, AgentChatTimelineItem } from "@/modules/ai/lib/agentChatTimeline";

export function ChatHistoryCard({ attachment }: { attachment: AgentChatHistoryAttachment }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/55 px-2.5 py-2 text-left">
      <HugeiconsIcon icon={AiChat01Icon} size={15} strokeWidth={1.8} className="text-muted-foreground" />
      <span>
        <span className="block text-xs font-medium text-foreground">{attachment.title}</span>
        <span className="block text-[11px] text-muted-foreground">{attachment.subtitle}</span>
      </span>
    </span>
  );
}

export function AgentUserPrompt({
  item,
  canEdit,
  onEdit,
}: {
  item: Extract<AgentChatTimelineItem, { kind: "user" }>;
  canEdit: boolean;
  onEdit: (text: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [copied, setCopied] = useState(false);
  const time = item.sentAt
    ? new Date(item.sentAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-3xl bg-foreground/10 p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none"
            autoFocus
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(item.text);
                setEditing(false);
              }}
              className="rounded-xl border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onEdit(draft).then(() => setEditing(false))}
              disabled={!draft.trim()}
              className="rounded-xl bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-end">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm leading-6 text-background">
          {item.attachments?.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {item.attachments.map((attachment, index) => (
                <ChatHistoryCard key={`${attachment.kind}-${index}`} attachment={attachment} />
              ))}
            </div>
          ) : null}
          <p>{item.text}</p>
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {time ? <span>{time}</span> : null}
          <button
            type="button"
            aria-label="Copy prompt"
            onClick={() =>
              void navigator.clipboard
                .writeText(item.text)
                .then(() => setCopied(true))
                .catch(() => undefined)
            }
            className="flex size-7 items-center justify-center rounded-md hover:bg-foreground/[0.07]"
            title={copied ? "Copied" : "Copy prompt"}
          >
            <HugeiconsIcon icon={Copy01Icon} size={15} strokeWidth={1.8} />
          </button>
          {canEdit ? (
            <button
              type="button"
              aria-label="Edit prompt"
              onClick={() => setEditing(true)}
              className="flex size-7 items-center justify-center rounded-md hover:bg-foreground/[0.07]"
              title="Edit prompt"
            >
              <HugeiconsIcon icon={Edit01Icon} size={15} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
