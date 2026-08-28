import { describe, expect, it } from "vitest";

import {
  getWorkspaceLoadingPresentation,
  shouldSuppressBootstrapShell,
} from "./startupGate";

describe("shouldSuppressBootstrapShell", () => {
  it("suppresses the bootstrap shell while startup workspace restore is pending", () => {
    expect(
      shouldSuppressBootstrapShell({
        activeTabId: 1,
        activeWorkspaceId: null,
        workspacesHydrated: false,
        initialWorkspaceActivationHandled: false,
        pendingBootstrapClose: false,
      }),
    ).toBe(true);
  });

  it("suppresses the bootstrap shell while the first workspace activation is still pending", () => {
    expect(
      shouldSuppressBootstrapShell({
        activeTabId: 1,
        activeWorkspaceId: null,
        workspacesHydrated: true,
        initialWorkspaceActivationHandled: false,
        pendingBootstrapClose: false,
      }),
    ).toBe(true);
  });

  it("shows the real workspace once startup ownership has been transferred", () => {
    expect(
      shouldSuppressBootstrapShell({
        activeTabId: 1,
        activeWorkspaceId: "workspace-01",
        workspacesHydrated: true,
        initialWorkspaceActivationHandled: true,
        pendingBootstrapClose: false,
      }),
    ).toBe(false);
  });

  it("does not hide non-bootstrap tabs", () => {
    expect(
      shouldSuppressBootstrapShell({
        activeTabId: 2,
        activeWorkspaceId: null,
        workspacesHydrated: false,
        initialWorkspaceActivationHandled: false,
        pendingBootstrapClose: false,
      }),
    ).toBe(false);
  });
});

describe("getWorkspaceLoadingPresentation", () => {
  it("keeps the startup loader blocking until the first workspace is ready", () => {
    expect(
      getWorkspaceLoadingPresentation({
        activeTabId: 1,
        activeWorkspaceId: null,
        workspacesHydrated: true,
        initialWorkspaceActivationHandled: true,
        pendingBootstrapClose: true,
        openingWorkspaceId: "workspace-01",
      }),
    ).toBe("blocking");
  });

  it("switches to a local loading state after startup when another workspace is opening", () => {
    expect(
      getWorkspaceLoadingPresentation({
        activeTabId: 2,
        activeWorkspaceId: "workspace-01",
        workspacesHydrated: true,
        initialWorkspaceActivationHandled: true,
        pendingBootstrapClose: false,
        openingWorkspaceId: "workspace-02",
      }),
    ).toBe("local");
  });

  it("returns idle once no workspace restore is pending", () => {
    expect(
      getWorkspaceLoadingPresentation({
        activeTabId: 2,
        activeWorkspaceId: "workspace-02",
        workspacesHydrated: true,
        initialWorkspaceActivationHandled: true,
        pendingBootstrapClose: false,
        openingWorkspaceId: null,
      }),
    ).toBe("idle");
  });
});
