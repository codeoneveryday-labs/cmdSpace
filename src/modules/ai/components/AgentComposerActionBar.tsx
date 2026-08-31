import {
  ArrowUp01Icon,
  Brain02Icon,
  CheckListIcon,
  Cancel01Icon,
  FlashIcon,
  ShieldBanIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AgentChatModelOption } from "@/modules/ai/lib/agentChatRuntime";
import type { AgentUsageStatus } from "@/modules/terminal/lib/terminal-native";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import { AgentAttachmentPicker } from "./AgentAttachmentPicker";
import { AgentContextWindowMeter } from "./AgentContextWindowMeter";
import { AgentModelPicker } from "./AgentModelPicker";
import { AgentSlashOptionPicker } from "./AgentSlashOptionPicker";
import { AgentVoiceControls, type VoiceRecorder } from "./AgentVoiceControls";

export function AgentComposerActionBar({
  provider,
  selectedModel,
  models,
  modelsLoading,
  modelsError,
  onLoadModels,
  onRefreshModels,
  onSelectModel,
  onFiles,
  onUrl,
  effortOptions,
  selectedEffort,
  modeOptions,
  selectedMode,
  controlsLoading,
  onLoadControls,
  onSelectEffort,
  onSelectMode,
  fastMode,
  setFastMode,
  planOption,
  selectedPlan,
  setSelectedPlan,
  voiceRecorder,
  active,
  voiceError,
  onStartVoice,
  usage,
  status,
  hasPrompt,
  hasAttachments,
  hydrated,
  onSend,
  onCancel,
}: {
  provider: CliAgent;
  selectedModel: string;
  models: AgentChatModelOption[];
  modelsLoading: boolean;
  modelsError: string | null;
  onLoadModels: () => void;
  onRefreshModels: () => void;
  onSelectModel: (model: string) => void;
  onFiles: (files: FileList | null) => void;
  onUrl: (label?: string) => void;
  effortOptions: AgentChatModelOption[];
  selectedEffort: string;
  modeOptions: AgentChatModelOption[];
  selectedMode: string;
  controlsLoading: boolean;
  onLoadControls: () => void;
  onSelectEffort: (value: string) => void;
  onSelectMode: (value: string) => void;
  fastMode: boolean;
  setFastMode: React.Dispatch<React.SetStateAction<boolean>>;
  planOption?: AgentChatModelOption;
  selectedPlan: string;
  setSelectedPlan: React.Dispatch<React.SetStateAction<string>>;
  voiceRecorder: VoiceRecorder;
  active: boolean;
  voiceError: string | null;
  onStartVoice: () => void;
  usage: AgentUsageStatus | null;
  status: "idle" | "running" | "error";
  hasPrompt: boolean;
  hasAttachments: boolean;
  hydrated: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
        <div className="flex min-w-0 items-center gap-0.5">
          <AgentAttachmentPicker onFiles={onFiles} onUrl={onUrl} />
          <AgentModelPicker agent={provider} selectedModel={selectedModel} models={models} isLoading={modelsLoading} modelsError={modelsError} onOpen={onLoadModels} onRefresh={onRefreshModels} onSelect={onSelectModel} />
          <AgentSlashOptionPicker options={effortOptions} selected={selectedEffort} onSelect={onSelectEffort} onOpen={onLoadControls} emptyLabel="Effort" loading={controlsLoading} ariaLabel="Select reasoning effort" icon={Brain02Icon} />
          <AgentSlashOptionPicker options={modeOptions} selected={selectedMode} onSelect={onSelectMode} onOpen={onLoadControls} emptyLabel="Access mode" loading={controlsLoading} ariaLabel="Select agent mode" icon={ShieldBanIcon} />
          <button type="button" onClick={() => setFastMode((current) => !current)} aria-pressed={fastMode} aria-label="Toggle fast mode" className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${fastMode ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={FlashIcon} size={15} strokeWidth={1.9} /></button>
          {planOption ? <button type="button" onClick={() => setSelectedPlan((current) => current === planOption.id ? "" : planOption.id)} aria-pressed={selectedPlan === planOption.id} aria-label={`Toggle ${planOption.label}`} className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${selectedPlan === planOption.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={CheckListIcon} size={17} strokeWidth={1.8} /></button> : null}
        </div>
        {voiceRecorder.recording || voiceRecorder.transcribing ? <AgentVoiceControls recorder={voiceRecorder} active={active} voiceError={voiceError} onStart={onStartVoice} /> : <div className="flex shrink-0 items-center gap-0.5"><AgentContextWindowMeter usage={usage} /><AgentVoiceControls recorder={voiceRecorder} active={active} voiceError={voiceError} onStart={onStartVoice} />{status === "running" && (hasPrompt || hasAttachments) ? <button type="button" onClick={onSend} aria-label="Steer agent with this prompt" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-2.5 text-xs font-medium text-background"><HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={2} /><span>Steer</span></button> : status === "running" ? <button type="button" onClick={onCancel} aria-label="Cancel agent turn" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} /></button> : <button type="button" onClick={onSend} disabled={!hydrated || (!hasPrompt && !hasAttachments)} aria-label="Send message" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-35"><HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} /></button>}</div>}
      </div>
      {voiceError ? <p role="alert" className="mt-2 px-1 text-xs text-destructive">{voiceError}</p> : null}
    </>
  );
}
