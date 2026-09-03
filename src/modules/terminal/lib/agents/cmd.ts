import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const cmdAgentHandler: CliAgentHandler = {
  agent: "cmd",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "cmd",
      fastMode: {
        supported: false,
      },
      permissions: [
        {
          id: "default",
          label: "/mode:default",
          command: "/mode:default\r",
        },
        {
          id: "auto-accept",
          label: "/mode:auto-accept",
          command: "/mode:auto-accept\r",
        },
        {
          id: "plan",
          label: "/mode:plan",
          command: "/mode:plan\r",
        },
        {
          id: "goal",
          label: "/goal",
          command: "/goal ",
        },
        {
          id: "todos",
          label: "/todos",
          command: "/todos\r",
        },
        {
          id: "config",
          label: "/config",
          command: "/config\r",
        },
        {
          id: "status",
          label: "/status",
          command: "/status\r",
        },
      ],
      defaultPermissionId: "default",
    };
  },

  executeCommand(command: string, onWrite: (data: string) => void): void {
    if (command.startsWith("/goal")) {
      // Do not auto-submit /goal; only populate the prompt with "/goal " so the user can type the objective
      onWrite("/goal ");
      return;
    }

    // 1. Send the slash command + Enter (selects from slash popup menu in Command Code)
    onWrite(command);
    // 2. Send Enter after a 50ms tick to submit the command from the composer prompt
    setTimeout(() => {
      onWrite("\r");
    }, 50);
  },
};

