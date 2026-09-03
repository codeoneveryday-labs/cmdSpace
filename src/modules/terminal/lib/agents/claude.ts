import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const claudeAgentHandler: CliAgentHandler = {
  agent: "claude",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "claude",
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
          id: "config",
          label: "/config",
          command: "/config\r",
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
    onWrite(command);
  },

  detectFastMode(buffer: string): boolean | null {
    const lastOnIndex = Math.max(
      buffer.lastIndexOf("Fast mode ON"),
      buffer.lastIndexOf("Fast mode on"),
    );

    const lastOffIndex = Math.max(
      buffer.lastIndexOf("Fast mode OFF"),
      buffer.lastIndexOf("Fast mode off"),
      buffer.lastIndexOf("disabled by your organization"),
      buffer.lastIndexOf("Fast mode has been disabled"),
      buffer.lastIndexOf("Fast mode requires usage credits"),
      buffer.lastIndexOf("Fast mode unavailable"),
      buffer.lastIndexOf("not in your organization's allowed models"),
      buffer.lastIndexOf("network connectivity issues"),
    );

    if (lastOffIndex === -1 && lastOnIndex === -1) {
      return null;
    }

    return lastOnIndex > lastOffIndex;
  },

  handleFastModeFallback(buffer: string, onWrite: (data: string) => void): void {
    if (
      buffer.includes("Esc to cancel") &&
      (buffer.includes("disabled by your organization") ||
        buffer.includes("Fast mode unavailable") ||
        buffer.includes("Fast mode requires usage credits") ||
        buffer.includes("Fast mode has been disabled"))
    ) {
      onWrite("\x1b");
    }
  },
};

