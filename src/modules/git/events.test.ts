import { describe, expect, it } from "vitest";
import {
  gitRepoRootFromChangedEvent,
  pathBelongsToRepo,
} from "./events";

describe("git repo change events", () => {
  it("extracts a changed repo root from custom event details", () => {
    const event = { detail: { repoRoot: "/repo" } } as unknown as Event;

    expect(gitRepoRootFromChangedEvent(event)).toBe("/repo");
  });

  it("matches only paths that are inside the changed repo root", () => {
    expect(pathBelongsToRepo("/repo", "/repo")).toBe(true);
    expect(pathBelongsToRepo("/repo/packages/app", "/repo")).toBe(true);
    expect(pathBelongsToRepo("/repo-other", "/repo")).toBe(false);
    expect(pathBelongsToRepo(null, "/repo")).toBe(false);
  });
});
