import { useEffect, useRef, useState } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  listAgentChatModels,
  listAgentChatSlashOptions,
  loadAgentChatConfig,
  loadAgentModelCache,
  saveAgentChatConfig,
  saveAgentModelCache,
  type AgentChatModelOption,
} from "@/modules/ai/lib/agentChatRuntime";

export function useAgentChatControls({
  provider,
  cwd,
  chatId,
}: {
  provider: CliAgent;
  cwd: string;
  chatId: string;
}) {
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AgentChatModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [effortOptions, setEffortOptions] = useState<AgentChatModelOption[]>([]);
  const [modeOptions, setModeOptions] = useState<AgentChatModelOption[]>([]);
  const [planOptions, setPlanOptions] = useState<AgentChatModelOption[]>([]);
  const [selectedEffort, setSelectedEffort] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [fastMode, setFastMode] = useState(false);
  const modelsRequestedRef = useRef(false);
  const controlsRequestRef = useRef<Promise<[AgentChatModelOption[], AgentChatModelOption[], AgentChatModelOption[]]> | null>(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const refreshModels = () => {
    setAvailableModels([]);
    setModelsError(null);
    setModelsLoading(true);
    void listAgentChatModels(provider, cwd)
      .then((models) => {
        if (models.length === 0) return;
        const normalized = models.map((model) => ({
          id: model.id,
          label: model.label || model.id,
          description: model.description,
        }));
        setAvailableModels(normalized);
        setSelectedModel((current) => current || normalized[0]?.id || "");
        void saveAgentModelCache({ provider, models: normalized, updatedAt: Date.now() });
      })
      .catch((error) => setModelsError(error instanceof Error ? error.message : String(error)))
      .finally(() => setModelsLoading(false));
  };

  const loadModelsOnDemand = () => {
    if (modelsRequestedRef.current || modelsLoading) return;
    modelsRequestedRef.current = true;
    refreshModels();
  };

  const loadControls = () => {
    if (!controlsRequestRef.current) {
      setControlsLoading(true);
      controlsRequestRef.current = Promise.all([
        listAgentChatSlashOptions(provider, cwd, "/effort"),
        listAgentChatSlashOptions(provider, cwd, provider === "codex" ? "/permissions" : "/mode"),
        listAgentChatSlashOptions(provider, cwd, "/plan"),
      ]).finally(() => setControlsLoading(false));
    }
    return controlsRequestRef.current;
  };

  const applyControlOptions = (
    [efforts, modes, plans]: [AgentChatModelOption[], AgentChatModelOption[], AgentChatModelOption[]],
    defaults: { effort?: string | null; permissionMode?: string | null; planMode?: boolean },
  ) => {
    setEffortOptions(efforts);
    setModeOptions(modes);
    setPlanOptions(plans);
    setSelectedEffort(defaults.effort ?? efforts[0]?.id ?? "");
    setSelectedMode(defaults.permissionMode ?? modes[0]?.id ?? "");
    setSelectedPlan(defaults.planMode ? (plans[0]?.id ?? "plan") : "");
  };

  const loadControlsOnDemand = () => {
    void loadControls()
      .then((options) => applyControlOptions(options, {
        effort: selectedEffort || null,
        permissionMode: selectedMode || null,
        planMode: Boolean(selectedPlan),
      }))
      .catch(() => {
        setEffortOptions([]);
        setModeOptions([]);
        setPlanOptions([]);
      });
  };

  useEffect(() => {
    let cancelled = false;
    void loadAgentModelCache(provider)
      .then((cache) => {
        if (cancelled || !cache || cache.models.length === 0) return;
        setAvailableModels(cache.models);
        setSelectedModel((current) => current || cache.models[0]?.id || "");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await loadAgentChatConfig(chatId).catch(() => null);
      if (cancelled) return;
      if (config) {
        setSelectedModel(config.model ?? "");
        setSelectedEffort(config.effort ?? "");
        setSelectedMode(config.permissionMode ?? "");
        setFastMode(config.fastMode);
        setSelectedPlan(config.planMode ? "plan" : "");
      }
      if (!cancelled) setConfigLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [chatId]);

  useEffect(() => {
    if (!configLoaded) return;
    const timer = window.setTimeout(() => {
      void saveAgentChatConfig({
        chatId,
        provider,
        model: selectedModel || null,
        effort: selectedEffort || null,
        permissionMode: selectedMode || null,
        fastMode,
        planMode: Boolean(selectedPlan),
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [chatId, configLoaded, fastMode, provider, selectedEffort, selectedMode, selectedModel, selectedPlan]);

  return {
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
  };
}
