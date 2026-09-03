import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const geminiAgentHandler: CliAgentHandler = {
  agent: "gemini",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "gemini",
      fastMode: {
        supported: false,
      },
      permissions: [
        {
          id: "permissions",
          label: "/permissions",
          command: "/permissions\r",
        },
        {
          id: "plan",
          label: "/plan",
          command: "/plan\r",
        },
        {
          id: "goal",
          label: "/goal",
          command: "/goal ",
        },
        {
          id: "settings",
          label: "/settings",
          command: "/settings\r",
        },
        {
          id: "yolo",
          label: "/yolo",
          command: "/yolo\r",
        },
        {
          id: "policies",
          label: "/policies",
          command: "/policies\r",
        },
        {
          id: "model",
          label: "/model",
          command: "/model\r",
        },
      ],
      defaultPermissionId: "permissions",
    };
  },

  executeCommand(command: string, onWrite: (data: string) => void): void {
    if (command.startsWith("/goal")) {
      // Do not auto-submit /goal; only populate the prompt with "/goal " so the user can type the objective
      onWrite("/goal ");
      return;
    }

    // 1. Send the slash command + Enter (selects from slash popup menu in Gemini CLI)
    onWrite(command);
    // 2. Send Enter after a 50ms tick to submit the command from the composer prompt
    setTimeout(() => {
      onWrite("\r");
    }, 50);
  },
};

