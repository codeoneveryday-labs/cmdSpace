import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const copilotAgentHandler: CliAgentHandler = {
  agent: "copilot",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "copilot",
      fastMode: {
        supported: false,
      },
      permissions: [
        {
          id: "allow-all",
          label: "Allow All",
          description: "Allow all tools for session (/allow-all)",
          command: "/allow-all\r",
        },
        {
          id: "reset",
          label: "Reset",
          description: "Reset allowed tools to prompt (/reset-allowed-tools)",
          command: "/reset-allowed-tools\r",
        },
        {
          id: "dirs",
          label: "Dirs",
          description: "List trusted directories (/list-dirs)",
          command: "/list-dirs\r",
        },
      ],
      defaultPermissionId: "allow-all",
    };
  },
};
