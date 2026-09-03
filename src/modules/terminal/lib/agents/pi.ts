import type { CliAgentControlProfile, CliAgentHandler } from "./types";
import { ompAgentHandler } from "./omp";

export const piAgentHandler: CliAgentHandler = {
  agent: "pi",
  getProfile(): CliAgentControlProfile {
    return {
      agent: "pi",
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
    return ompAgentHandler.detectFastMode?.(buffer) ?? null;
  },
};

