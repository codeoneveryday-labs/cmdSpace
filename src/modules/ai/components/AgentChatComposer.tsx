import type { ComponentProps, CSSProperties, KeyboardEvent } from "react";
import { AgentComposerActionBar } from "./AgentComposerActionBar";
import { AgentComposerAttachments } from "./AgentComposerAttachments";

type Props = {
  draft: string;
  textStyle: CSSProperties;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  attachments: ComponentProps<typeof AgentComposerAttachments>;
  actionBar: ComponentProps<typeof AgentComposerActionBar>;
};

export function AgentChatComposer({
  draft,
  textStyle,
  onDraftChange,
  onSubmit,
  attachments,
  actionBar,
}: Props) {
  const handleSubmit = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="shrink-0 px-5 pb-5 pt-3 sm:px-10">
      <div className="mx-auto w-full max-w-3xl rounded-[22px] border border-border/80 bg-card/60 p-3 shadow-sm transition-colors focus-within:border-border focus-within:bg-card/80">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleSubmit}
          rows={2}
          placeholder="Message the agent, tag @files, or use /commands and /skills"
          aria-label="Message the agent"
          style={textStyle}
          className="w-full resize-none bg-transparent px-1 leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        />
        <AgentComposerAttachments {...attachments} />
        <AgentComposerActionBar {...actionBar} />
      </div>
    </div>
  );
}
