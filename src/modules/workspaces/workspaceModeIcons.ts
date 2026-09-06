import {
  AiGenerativeIcon,
  CommandLineIcon,
  WorkflowSquare07Icon,
} from "@hugeicons/core-free-icons";

export const WORKSPACE_MODE_ICONS = {
  standard: CommandLineIcon,
  canvas: WorkflowSquare07Icon,
  agent: AiGenerativeIcon,
} as const;

export type WorkspaceModeIconKey = keyof typeof WORKSPACE_MODE_ICONS;

export function getWorkspaceModeIcon(mode: WorkspaceModeIconKey) {
  return WORKSPACE_MODE_ICONS[mode];
}
