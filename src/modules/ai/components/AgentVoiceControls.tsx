import { Cancel01Icon, Mic01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export type VoiceRecorder = {
  recording: boolean;
  transcribing: boolean;
  audioLevel: number;
  duration: number;
  cancel: () => void;
  confirm: () => void;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function VoiceLevelMeter({ audioLevel, active }: { audioLevel: number; active: boolean }) {
  const bars = [0.48, 0.76, 1, 0.76, 0.48];
  return (
    <span className="flex size-8 items-center justify-center gap-0.5 text-muted-foreground" aria-hidden="true">
      {bars.map((weight, index) => (
        <span key={index} className="w-0.5 rounded-full bg-current transition-transform duration-75" style={{ height: `${7 + (index % 3) * 3}px`, transform: `scaleY(${active ? 0.28 + audioLevel * 0.72 * weight : 0.42})`, opacity: active ? 1 : 0.6 }} />
      ))}
    </span>
  );
}

export function AgentVoiceControls({
  recorder,
  active,
  voiceError,
  onStart,
}: {
  recorder: VoiceRecorder;
  active: boolean;
  voiceError?: string | null;
  onStart: () => void;
}) {
  if (recorder.recording || recorder.transcribing) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={recorder.cancel} disabled={recorder.transcribing} aria-label="Cancel voice transcript" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-40"><HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} /></button>
        <VoiceLevelMeter audioLevel={recorder.audioLevel} active={recorder.recording} />
        <span className="min-w-10 font-mono text-xs tabular-nums text-muted-foreground">{recorder.transcribing ? "…" : formatDuration(recorder.duration)}</span>
        <button type="button" onClick={recorder.confirm} disabled={recorder.transcribing} aria-label="Confirm voice transcript" className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:opacity-85 disabled:opacity-40"><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.2} /></button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onStart} disabled={!active} aria-label="Voice to text" title={voiceError ?? "Voice to text"} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-40"><HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={1.8} /></button>
  );
}
