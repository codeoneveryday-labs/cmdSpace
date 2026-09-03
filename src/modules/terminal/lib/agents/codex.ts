import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const codexAgentHandler: CliAgentHandler = {
  agent: "codex",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "codex",
      fastMode: {
        supported: true,
        command: "/fast\r",
        label: "Toggle fast mode (/fast)",
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
          id: "review",
          label: "/review",
          command: "/review\r",
        },
        {
          id: "status",
          label: "/status",
          command: "/status\r",
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

    // 1. Send the slash command + Enter (fills/selects from autocomplete popup in Codex TUI)
    onWrite(command);
    // 2. Send Enter after a 50ms tick to submit the command from the composer prompt
    setTimeout(() => {
      onWrite("\r");
    }, 50);
  },

  detectFastMode(buffer: string): boolean | null {
    const lastOnIndex = Math.max(
      buffer.lastIndexOf("Fast mode ON"),
      buffer.lastIndexOf("Fast mode on"),
      buffer.lastIndexOf("Fast mode: on"),
      buffer.lastIndexOf("Fast mode: ON"),
      buffer.lastIndexOf("Fast mode enabled"),
      buffer.lastIndexOf("Fast tier: on"),
      buffer.lastIndexOf("Fast tier enabled"),
    );

    const lastOffIndex = Math.max(
      buffer.lastIndexOf("Fast mode OFF"),
      buffer.lastIndexOf("Fast mode off"),
      buffer.lastIndexOf("Fast mode: off"),
      buffer.lastIndexOf("Fast mode: OFF"),
      buffer.lastIndexOf("Fast mode disabled"),
      buffer.lastIndexOf("Fast tier: off"),
      buffer.lastIndexOf("Fast mode is not available"),
      buffer.lastIndexOf("Fast mode is not supported"),
      buffer.lastIndexOf("does not support fast mode"),
      buffer.lastIndexOf("insufficient credits"),
      buffer.lastIndexOf("credit limit reached"),
    );

    if (lastOffIndex === -1 && lastOnIndex === -1) {
      return null;
    }

    return lastOnIndex > lastOffIndex;
  },

  handleFastModeFallback(buffer: string, onWrite: (data: string) => void): void {
    if (
      buffer.includes("Esc to cancel") &&
      (buffer.includes("Fast mode is not available") ||
        buffer.includes("does not support fast mode") ||
        buffer.includes("insufficient credits"))
    ) {
      onWrite("\x1b");
    }
  },
};
