import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const opencodeAgentHandler: CliAgentHandler = {
  agent: "opencode",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "opencode",
      fastMode: {
        supported: false,
      },
      permissions: [
        {
          id: "models",
          label: "/models",
          description: "Select and switch model",
          command: "/models\r",
        },
        {
          id: "variants",
          label: "/variants",
          description: "Select a model variant",
          command: "/variants\r",
        },
        {
          id: "skills",
          label: "/skills",
          description: "Browse and manage skills",
          command: "/skills\r",
        },
        {
          id: "thinking",
          label: "/thinking",
          description: "Toggle reasoning / thinking visibility",
          command: "/thinking ",
        },
      ],
      defaultPermissionId: "models",
    };
  },

  executeCommand(command: string, onWrite: (data: string) => void): void {
    if (command.startsWith("/thinking")) {
      // Do not auto-submit /thinking; only populate the prompt with "/thinking "
      onWrite("/thinking ");
      return;
    }

    // 1. Send the slash command + Enter (selects from slash popup menu in OpenCode)
    onWrite(command);
    // 2. Send Enter after a 50ms tick to submit the command from the composer prompt
    setTimeout(() => {
      onWrite("\r");
    }, 50);
  },
};
