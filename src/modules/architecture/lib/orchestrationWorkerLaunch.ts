import {
  CLI_AGENT_DEFINITIONS,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";

export type OrchestrationWorkerLaunchKind = "structured" | "manual";

export type OrchestrationWorkerLaunchSpec = {
  provider: string;
  executable: string;
  displayName: string;
  launchCommand: string;
  argv: string[];
  kind: OrchestrationWorkerLaunchKind;
  installHint?: string;
};

function splitLaunchCommand(launch: string): string[] {
  const argv: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const char of launch.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === " " || char === "\t") {
      if (current) {
        argv.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) argv.push(current);
  return argv;
}

/**
 * Pure argv builder over the CLI catalog: split the launch string, tag
 * structured vs manual workers by chatTransport. No spawning here — callers
 * (workers hook, manual panel) own the PTY lifecycle.
 */
export function buildWorkerLaunchSpec(provider: string): OrchestrationWorkerLaunchSpec {
  const definition = CLI_AGENT_DEFINITIONS.find(
    (candidate) => candidate.id === (provider as CliAgent),
  );
  const launchCommand = definition?.launch ?? provider;
  return {
    provider,
    executable: definition?.executable ?? launchCommand.split(" ")[0] ?? provider,
    displayName: definition?.name ?? provider,
    launchCommand,
    argv: splitLaunchCommand(launchCommand),
    kind: definition?.chatTransport ? "structured" : "manual",
  };
}

export function planWorkerLaunchSpecs(
  providers: readonly string[],
): OrchestrationWorkerLaunchSpec[] {
  return providers.map(buildWorkerLaunchSpec);
}
