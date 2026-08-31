import { useCallback, type Dispatch, type SetStateAction } from "react";
import { native } from "@/modules/ai/lib/native";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { AgentAttachment } from "./useAgentAttachments";
import { composeAgentChatPrompt } from "@/modules/ai/lib/agentChatPromptModel";
import { createAgentEditBaseline } from "@/modules/ai/lib/agentChatEdits";

type DispatchPrompt = (
  prompt: string,
  model: string | undefined,
  displayPrompt: string,
  attachments: AgentChatHistoryAttachment[],
) => Promise<boolean>;

export function useAgentChatSubmit({
  cwd,
  draft,
  attachments,
  historyAttachments,
  selectedModel,
  timelineStatus,
  submit,
  steer,
  beginEditTracking,
  setDraft,
  clearAttachments,
  setHistoryAttachments,
  clearEditFiles,
}: {
  cwd: string;
  draft: string;
  attachments: AgentAttachment[];
  historyAttachments: AgentChatHistoryAttachment[];
  selectedModel: string | undefined;
  timelineStatus: "idle" | "running" | "error";
  submit: DispatchPrompt;
  steer: DispatchPrompt;
  beginEditTracking: (
    snapshot: Parameters<typeof createAgentEditBaseline>[0] | null,
  ) => void;
  setDraft: Dispatch<SetStateAction<string>>;
  clearAttachments: () => void;
  setHistoryAttachments: Dispatch<SetStateAction<AgentChatHistoryAttachment[]>>;
  clearEditFiles: () => void;
}) {
  return useCallback(async () => {
    const { prompt, displayPrompt, composedPrompt } = composeAgentChatPrompt({
      draft,
      attachments,
      historyAttachments,
    });
    if (!prompt && attachments.length === 0 && historyAttachments.length === 0) return;

    const baselineSnapshot = await native.gitPanelSnapshot(cwd).catch(() => null);
    beginEditTracking(baselineSnapshot);
    const dispatch = timelineStatus === "running" ? steer : submit;
    if (await dispatch(composedPrompt, selectedModel, displayPrompt, historyAttachments)) {
      setDraft("");
      clearAttachments();
      setHistoryAttachments([]);
    } else {
      clearEditFiles();
    }
  }, [
    attachments,
    beginEditTracking,
    clearAttachments,
    clearEditFiles,
    cwd,
    draft,
    historyAttachments,
    selectedModel,
    setDraft,
    setHistoryAttachments,
    steer,
    submit,
    timelineStatus,
  ]);
}
