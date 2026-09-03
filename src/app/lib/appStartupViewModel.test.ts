import { describe, expect, it } from "vitest";
import { getAppStartupView } from "./appStartupViewModel";

const base = {
  activeTabId: 2,
  activeWorkspaceId: "workspace-1",
  workspacesHydrated: true,
  initialWorkspaceActivationHandled: true,
  pendingBootstrapClose: false,
  openingWorkspaceId: null,
  workspaces: [],
};

describe("appStartupViewModel", () => {
  it("derives idle state when the shell is ready", () => {
    expect(getAppStartupView(base)).toMatchObject({
      hideBootstrapShell: false,
      showWorkspaceSwitchLoading: false,
      workspaceLoadingLabel: "Opening workspace…",
    });
  });

  it("derives local loading state and labels the opening workspace", () => {
    expect(
      getAppStartupView({
        ...base,
        openingWorkspaceId: "workspace-2",
        workspaces: [
          { id: "workspace-2", name: "Docs" } as never,
        ],
      }),
    ).toMatchObject({
      hideBootstrapShell: false,
      showWorkspaceSwitchLoading: true,
      workspaceLoadingLabel: "Opening Docs…",
    });
  });

  it("middle-truncates long workspace names in the loading label", () => {
    const view = getAppStartupView({
      ...base,
      openingWorkspaceId: "workspace-long",
      workspaces: [
        {
          id: "workspace-long",
          name: "Super long nameaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        } as never,
      ],
    });
    expect(view.workspaceLoadingLabel).toMatch(/^Opening Super long.*aaaa…$/);
    expect(view.workspaceLoadingLabel).toContain("...");
  });

  it("suppresses the bootstrap shell while the first workspace is unresolved", () => {
    expect(
      getAppStartupView({
        ...base,
        activeTabId: 1,
        activeWorkspaceId: null,
        workspacesHydrated: false,
      }).hideBootstrapShell,
    ).toBe(true);
  });
});
