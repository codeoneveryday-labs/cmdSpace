import { useRef, useState } from "react";
import {
  Add01Icon,
  Attachment01Icon,
  GithubIcon,
  ImageAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function AgentAttachmentPicker({
  onFiles,
  onUrl,
}: {
  onFiles: (files: FileList | null) => void;
  onUrl: (label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement) => {
    setOpen(false);
    input.click();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Add attachment"
        >
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-56 gap-1 rounded-2xl p-2">
        <button type="button" onClick={() => pick(imageInputRef.current!)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={ImageAdd01Icon} size={18} strokeWidth={1.8} /> Add image</button>
        <button type="button" onClick={() => { setOpen(false); onUrl("Add issue or PR"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={GithubIcon} size={18} strokeWidth={1.8} /> Add issue or PR</button>
        <button type="button" onClick={() => pick(fileInputRef.current!)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={Attachment01Icon} size={18} strokeWidth={1.8} /> Upload file</button>
        <button type="button" onClick={() => { setOpen(false); onUrl("Attach URL"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={Attachment01Icon} size={18} strokeWidth={1.8} /> Attach URL</button>
      </PopoverContent>
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
    </Popover>
  );
}
