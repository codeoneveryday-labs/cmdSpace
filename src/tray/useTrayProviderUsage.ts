import { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getEnabledCliAgentDefinitions } from "@/modules/terminal/lib/cliAgents";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import { loadPreferences } from "@/modules/settings/store";

export type ProviderLimitStatus = {
  provider: string;
  rateLimits: Array<{
    label: string;
    usedPercent: number;
    windowMinutes?: number;
    resetsAt?: number;
  }>;
  accountUsage?: { plan?: string; usedPercent?: number };
  sessionUsage?: { inputTokens: number; outputTokens: number };
};

export function useTrayProviderUsage() {
  const [usageAgents, setUsageAgents] = useState<CliAgentDefinition[]>([]);
  const [statuses, setStatuses] = useState<ProviderLimitStatus[]>([]);
  const [pendingProviders, setPendingProviders] = useState<Set<string>>(
    () => new Set(),
  );
  const usageRequestId = useRef(0);

  const refreshUsage = useCallback(async () => {
    const requestId = ++usageRequestId.current;
    let agents: CliAgentDefinition[];
    try {
      const preferences = await loadPreferences();
      agents = getEnabledCliAgentDefinitions(
        preferences.cliAgentIds,
        preferences.disabledCliAgentIds,
      );
    } catch {
      if (requestId === usageRequestId.current) {
        setUsageAgents([]);
        setPendingProviders(new Set());
      }
      return;
    }
    if (requestId !== usageRequestId.current) return;

    const enabledIds = new Set<string>(agents.map((agent) => agent.id));
    setUsageAgents(agents);
    setStatuses((current) =>
      current.filter((status) => enabledIds.has(status.provider)),
    );
    setPendingProviders(enabledIds);

    await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const status = await invoke<ProviderLimitStatus | null>(
            "provider_limit_status",
            { provider: agent.id },
          );
          if (requestId === usageRequestId.current) {
            setStatuses((current) => {
              const others = current.filter(
                (item) => item.provider !== agent.id,
              );
              return status ? [...others, status] : others;
            });
          }
        } finally {
          if (requestId === usageRequestId.current) {
            setPendingProviders((current) => {
              const next = new Set(current);
              next.delete(agent.id);
              return next;
            });
          }
        }
      }),
    );
  }, []);

  const visibleUsage = useMemo(
    () =>
      usageAgents.flatMap((agent) => {
        const status = statuses.find((item) => item.provider === agent.id);
        return status && hasUsageData(status) ? [{ agent, status }] : [];
      }),
    [statuses, usageAgents],
  );
  const hasPendingUsage = usageAgents.some(
    (agent) =>
      pendingProviders.has(agent.id) &&
      !statuses.some((status) => status.provider === agent.id),
  );

  return {
    refreshUsage,
    usageAgents,
    statuses,
    pendingProviders,
    visibleUsage,
    hasPendingUsage,
  };
}

export function hasUsageData(status: ProviderLimitStatus): boolean {
  return Boolean(
    status.accountUsage || status.rateLimits.length > 0 || status.sessionUsage,
  );
}
