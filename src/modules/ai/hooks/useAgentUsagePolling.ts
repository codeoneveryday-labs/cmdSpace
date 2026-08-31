import { useEffect, useState } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  getAgentUsageStatuses,
  type AgentUsageStatus,
} from "@/modules/terminal/lib/terminal-native";

export function useAgentUsagePolling({
  active,
  cwd,
  provider,
  nativeSessionId,
  status,
}: {
  active: boolean;
  cwd: string;
  provider: CliAgent;
  nativeSessionId: string | null;
  status: string;
}) {
  const [usage, setUsage] = useState<AgentUsageStatus | null>(null);
  const supported = provider === "codex" || provider === "claude";

  useEffect(() => {
    if (!active || !supported || !nativeSessionId) {
      setUsage(null);
      return;
    }
    let disposed = false;
    const refresh = async () => {
      try {
        const statuses = await getAgentUsageStatuses(cwd, provider, nativeSessionId);
        if (!disposed) setUsage(statuses.find((item) => item.provider === provider) ?? null);
      } catch {
        if (!disposed) setUsage(null);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [active, cwd, nativeSessionId, provider, status, supported]);

  return usage;
}
