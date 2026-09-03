import type { CliAgentControlProfile, CliAgentHandler } from "./types";

export const ompAgentHandler: CliAgentHandler = {
  agent: "omp",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "omp",
      fastMode: {
        supported: true,
        command: "/fast\r",
        label: "Toggle fast mode (/fast)",
      },
      permissions: [
        {
          id: "plan",
          label: "/plan",
          description: "Toggle plan mode",
          command: "/plan\r",
        },
        {
          id: "models",
          label: "/models",
          description: "Select and switch model",
          command: "/models\r",
        },
        {
          id: "skills",
          label: "/skills",
          description: "Browse and manage skills",
          command: "/skills\r",
        },
      ],
      defaultPermissionId: "plan",
    };
  },

  detectFastMode(buffer: string): boolean | null {
    const lastOnIndex = Math.max(
      buffer.lastIndexOf("Fast mode ON"),
      buffer.lastIndexOf("Fast mode on"),
      buffer.lastIndexOf("Fast mode: on"),
      buffer.lastIndexOf("Fast mode enabled"),
      buffer.lastIndexOf("fast mode enabled"),
    );
    const lastOffIndex = Math.max(
      buffer.lastIndexOf("Fast mode OFF"),
      buffer.lastIndexOf("Fast mode off"),
      buffer.lastIndexOf("Fast mode: off"),
      buffer.lastIndexOf("Fast mode disabled"),
      buffer.lastIndexOf("fast mode disabled"),
    );
    if (lastOnIndex === -1 && lastOffIndex === -1) return null;
    return lastOnIndex > lastOffIndex;
  },
};
