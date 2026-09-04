import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import { CLI_AGENT_BY_ID, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import { useAgentChatSession } from "@/modules/ai/hooks/useAgentChatSession";
import { useWhisperRecording } from "@/modules/ai/hooks/useWhisperRecording";
import { useAgentChatControls } from "@/modules/ai/hooks/useAgentChatControls";
import { useAgentEditSummary } from "@/modules/ai/hooks/useAgentEditSummary";
import { useAgentUsagePolling } from "@/modules/ai/hooks/useAgentUsagePolling";
import { useAgentAttachments } from "@/modules/ai/hooks/useAgentAttachments";
import { useAgentEditActions } from "@/modules/ai/hooks/useAgentEditActions";
import type { ProviderKeys } from "@/modules/ai/lib/keyring";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import { appendVoiceTranscript } from "@/modules/ai/lib/agentChatPromptModel";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { AiChat01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { AgentChatHistory } from "./AgentChatHistory";
import { AgentChatComposer } from "./AgentChatComposer";
import { useAgentChatSubmit } from "../hooks/useAgentChatSubmit";

type Props = {
  workspaceId: string;
  chatId: string;
  active: boolean;
  provider: CliAgent;
  cwd: string;
  nativeSessionId: string | null;
  onNativeSessionId: (nativeSessionId: string) => void;
  apiKeys: ProviderKeys;
  initialDraft?: string;
  initialHistoryAttachments?: AgentChatHistoryAttachment[];
  onForkResponse: (destination: "tab" | "workspace", attachment: AgentChatHistoryAttachment) => void;
  onOpenFileDiff?: (input: { path: string; repoRoot: string; mode: "-"; originalPath: string | null }) => void;
};

export function AgentChatWorkspace({
  workspaceId,
  chatId,
  active,
  provider,
  cwd,
  nativeSessionId,
  onNativeSessionId,
  apiKeys,
  initialDraft = "",
  initialHistoryAttachments = [],
  onForkResponse,
  onOpenFileDiff,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const {
    attachments,
    setAttachments,
    handleFiles,
    handleUrl,
    clearAttachments,
  } = useAgentAttachments();
  const [historyAttachments, setHistoryAttachments] = useState(initialHistoryAttachments);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const speechToTextModelId = usePreferencesStore((state) => state.speechToTextModelId);
  const terminalFontFamily = usePreferencesStore((state) => state.terminalFontFamily);
  const terminalFontSize = usePreferencesStore((state) => state.terminalFontSize);
  const terminalLetterSpacing = usePreferencesStore((state) => state.terminalLetterSpacing);
  const chatTextStyle = useMemo(() => ({
    fontFamily: terminalFontFamily || undefined,
    fontSize: `${terminalFontSize}px`,
    letterSpacing: `${terminalLetterSpacing}px`,
  }), [terminalFontFamily, terminalFontSize, terminalLetterSpacing]);
  const {
    selectedModel,
    setSelectedModel,
    availableModels,
    modelsLoading,
    modelsError,
    effortOptions,
    modeOptions,
    planOptions,
    selectedEffort,
    setSelectedEffort,
    selectedMode,
    setSelectedMode,
    selectedPlan,
    setSelectedPlan,
    fastMode,
    setFastMode,
    controlsLoading,
    loadModelsOnDemand,
    refreshModels,
    loadControlsOnDemand,
  } = useAgentChatControls({ provider, cwd, chatId });
  const { timeline, submit, cancel, steer, rewriteFromPrompt, hydrated } = useAgentChatSession({
    provider,
    chatId,
    active,
    workspaceId,
    cwd,
    initialRuntimeSessionId: null,
    initialNativeSessionId: nativeSessionId,
    onNativeSessionId,
  });
  const { editFiles, setEditFiles, beginEditTracking } = useAgentEditSummary({
    cwd,
    timelineStatus: timeline.status,
  });
  const agent = CLI_AGENT_BY_ID[provider];
  const voiceRecorder = useWhisperRecording({
    ownerKey: `agent-chat:${chatId}`,
    onResult: (transcript) => {
      setDraft((current) => appendVoiceTranscript(current, transcript));
    },
    onError: setVoiceError,
    speechToTextModelId,
    apiKeys,
  });
  const agentUsage = useAgentUsagePolling({
    active,
    cwd,
    provider,
    nativeSessionId: timeline.nativeSessionId,
    status: timeline.status,
  });

  const planOption = planOptions.find((option) => /plan/i.test(`${option.id} ${option.label}`));

  const send = useAgentChatSubmit({
    cwd,
    draft,
    attachments,
    historyAttachments,
    selectedModel,
    timelineStatus: timeline.status,
    submit,
    steer,
    beginEditTracking,
    setDraft,
    clearAttachments,
    setHistoryAttachments,
    clearEditFiles: () => setEditFiles([]),
  });

  const { reviewEdits, undoEdits } = useAgentEditActions({
    editFiles,
    setEditFiles,
    onOpenFileDiff,
  });

  const startVoiceToText = async () => {
    if (voiceRecorder.transcribing || !voiceRecorder.supported) return;
    setVoiceError(null);
    await voiceRecorder.start();
  };

  useEffect(() => {
    if (timeline.status !== "running") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void cancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cancel, timeline.status]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-10 shrink-0 items-center border-b border-border/60 px-5 py-0">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={AiChat01Icon} size={18} strokeWidth={1.8} />
          <h2 className="truncate font-mono text-xs font-medium text-foreground" title={timeline.nativeSessionId ?? "Session ID pending"}>
            {timeline.nativeSessionId ?? "Session ID pending"}
          </h2>
          {timeline.status === "running" ? <AgentStateDot state="working" /> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <AgentChatHistory
          timeline={{
            items: timeline.items,
            provider,
            agentName: agent.name,
            chatTextStyle,
            status: timeline.status,
            error: timeline.error,
            usage: timeline.usage,
            onRewrite: (id, text) => rewriteFromPrompt(id, text, selectedModel),
            onFork: (destination, history) => onForkResponse(destination, history),
          }}
          editFiles={editFiles}
          onReviewEdits={reviewEdits}
          onUndoEdits={() => void undoEdits()}
        />
      </div>

      <AgentChatComposer
        draft={draft}
        textStyle={chatTextStyle}
        onDraftChange={setDraft}
        onSubmit={() => void send()}
        attachments={{
          attachments,
          historyAttachments,
          setAttachments,
          setHistoryAttachments,
        }}
        actionBar={{
            provider: provider,
            selectedModel: selectedModel,
            models: availableModels,
            modelsLoading: modelsLoading,
            modelsError: modelsError,
            onLoadModels: loadModelsOnDemand,
            onRefreshModels: refreshModels,
            onSelectModel: setSelectedModel,
            onFiles: handleFiles,
            onUrl: handleUrl,
            effortOptions: effortOptions,
            selectedEffort: selectedEffort,
            onSelectEffort: setSelectedEffort,
            modeOptions: modeOptions,
            selectedMode: selectedMode,
            onSelectMode: setSelectedMode,
            controlsLoading: controlsLoading,
            onLoadControls: loadControlsOnDemand,
            fastMode: fastMode,
            setFastMode: setFastMode,
            planOption: planOption,
            selectedPlan: selectedPlan,
            setSelectedPlan: setSelectedPlan,
            voiceRecorder: voiceRecorder,
            active: active,
            voiceError: voiceError,
            onStartVoice: () => void startVoiceToText(),
            usage: agentUsage,
            status: timeline.status,
            hasPrompt: Boolean(draft.trim()),
            hasAttachments: attachments.length > 0 || historyAttachments.length > 0,
            hydrated: hydrated,
            onSend: () => void send(),
            onCancel: () => void cancel(),
        }}
      />
    </section>
  );
}
