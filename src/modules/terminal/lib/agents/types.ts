import type { CliAgent } from "../cliAgents";

export type AgentPermissionOption = {
  id: string;
  label: string;
  description?: string;
  command: string;
  badge?: string;
};

export type AgentFastModeConfig = {
  supported: boolean;
  command?: string;
  label?: string;
};

export type CliAgentControlProfile = {
  agent: CliAgent;
  fastMode: AgentFastModeConfig;
  permissions: readonly AgentPermissionOption[];
  defaultPermissionId: string;
};

export interface CliAgentHandler {
  readonly agent: CliAgent;
  getProfile(): CliAgentControlProfile;
  executeCommand?(command: string, onWrite: (data: string) => void): void;
  detectFastMode?(buffer: string): boolean | null;
  handleFastModeFallback?(buffer: string, onWrite: (data: string) => void): void;
}
