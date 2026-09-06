import { describe, expect, it } from "vitest";
import {
  WORKSPACE_MODE_ICONS,
  getWorkspaceModeIcon,
} from "./workspaceModeIcons";

describe("workspace mode icons", () => {
  it("uses distinct semantic icons for each workspace mode", async () => {
    const { AiGenerativeIcon, CommandLineIcon, WorkflowSquare07Icon } =
      await import("@hugeicons/core-free-icons");

    expect(WORKSPACE_MODE_ICONS.standard).toBe(CommandLineIcon);
    expect(WORKSPACE_MODE_ICONS.canvas).toBe(WorkflowSquare07Icon);
    expect(WORKSPACE_MODE_ICONS.agent).toBe(AiGenerativeIcon);
    expect(getWorkspaceModeIcon("standard")).toBe(CommandLineIcon);
    expect(getWorkspaceModeIcon("canvas")).toBe(WorkflowSquare07Icon);
    expect(getWorkspaceModeIcon("agent")).toBe(AiGenerativeIcon);
  });
});
