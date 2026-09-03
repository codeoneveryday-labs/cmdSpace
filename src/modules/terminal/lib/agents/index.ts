import type { CliAgent } from "../cliAgents";
import { claudeAgentHandler } from "./claude";
import { codexAgentHandler } from "./codex";
import { geminiAgentHandler } from "./gemini";
import { opencodeAgentHandler } from "./opencode";
import { copilotAgentHandler } from "./copilot";
import { piAgentHandler } from "./pi";
import { cmdAgentHandler } from "./cmd";
import { ompAgentHandler } from "./omp";
import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export * from "./types";
export { claudeAgentHandler } from "./claude";
export { codexAgentHandler } from "./codex";
export { geminiAgentHandler } from "./gemini";
export { opencodeAgentHandler } from "./opencode";
export { copilotAgentHandler } from "./copilot";
export { piAgentHandler } from "./pi";
export { cmdAgentHandler } from "./cmd";
export { ompAgentHandler } from "./omp";

export const CLI_AGENT_HANDLERS: Partial<Record<CliAgent, CliAgentHandler>> = {
  claude: claudeAgentHandler,
  codex: codexAgentHandler,
  gemini: geminiAgentHandler,
  opencode: opencodeAgentHandler,
  copilot: copilotAgentHandler,
  pi: piAgentHandler,
  cmd: cmdAgentHandler,
  omp: ompAgentHandler,
};

export function getCliAgentHandler(
  agent: CliAgent | null | undefined,
): CliAgentHandler | undefined {
  if (!agent) return undefined;
  return CLI_AGENT_HANDLERS[agent];
}

export function detectAgentFastMode(
  agent: CliAgent | null | undefined,
  buffer: string | null | undefined,
): boolean | null {
  if (!agent || !buffer) return null;
  const handler = getCliAgentHandler(agent);
  if (handler?.detectFastMode) {
    return handler.detectFastMode(buffer);
  }
  return null;
}

export function handleAgentFastModeFallback(
  agent: CliAgent | null | undefined,
  buffer: string | null | undefined,
  onWrite: (data: string) => void,
): void {
  if (!agent || !buffer) return;
  const handler = getCliAgentHandler(agent);
  handler?.handleFastModeFallback?.(buffer, onWrite);
}

export function executeAgentCommand(
  agent: CliAgent | null | undefined,
  command: string,
  onWrite: (data: string) => void,
): void {
  if (!agent || !command) return;
  const handler = getCliAgentHandler(agent);
  if (handler?.executeCommand) {
    handler.executeCommand(command, onWrite);
  } else {
    onWrite(command);
  }
}


export function getCliAgentControlProfile(
  agent: CliAgent | null | undefined,
): CliAgentControlProfile {
  const handler = getCliAgentHandler(agent);
  if (handler) {
    return handler.getProfile();
  }
  return {
    agent: (agent || "claude") as CliAgent,
    fastMode: {
      supported: false,
    },
    permissions: [
      {
        id: "permissions",
        label: "Permissions",
        description: "Manage permissions (/permissions)",
        command: "/permissions\r",
      },
      {
        id: "config",
        label: "Config",
        description: "Open configuration (/config)",
        command: "/config\r",
      },
      {
        id: "plan",
        label: "Plan",
        description: "Plan mode (/plan)",
        command: "/plan\r",
      },
    ],
    defaultPermissionId: "permissions",
  };
}
