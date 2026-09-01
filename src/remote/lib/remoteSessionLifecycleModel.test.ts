import { describe, expect, it } from "vitest";

import type { RemoteProtocolSession } from "../remoteClient";
import {
  sessionsForRemoteCwd,
  shouldRetryRemoteSessionCreate,
  visibleRemoteSession,
} from "./remoteSessionLifecycleModel";

const sessions: RemoteProtocolSession[] = [
  {
    id: 1,
    title: "Project shell",
    cwd: "/workspace/project/",
    workspaceId: null,
    agent: null,
    attached: false,
  },
  {
    id: 2,
    title: "Other shell",
    cwd: "/workspace/other",
    workspaceId: null,
    agent: null,
    attached: false,
  },
];

describe("remote session lifecycle model", () => {
  it("matches the selected folder after normalizing trailing separators", () => {
    expect(sessionsForRemoteCwd(sessions, "/workspace/project")).toEqual([
      sessions[0],
    ]);
  });

  it("does not associate sessions when no folder is selected", () => {
    expect(sessionsForRemoteCwd(sessions, null)).toEqual([]);
  });

  it("keeps a valid active session or falls back to the first folder session", () => {
    const cwdSessions = sessionsForRemoteCwd(sessions, "/workspace/project");

    expect(visibleRemoteSession(cwdSessions, 1)?.id).toBe(1);
    expect(visibleRemoteSession(cwdSessions, 99)?.id).toBe(1);
  });

  it("limits retry creates after the configured attempt budget", () => {
    expect(shouldRetryRemoteSessionCreate(9, 10)).toBe(true);
    expect(shouldRetryRemoteSessionCreate(10, 10)).toBe(false);
  });
});
