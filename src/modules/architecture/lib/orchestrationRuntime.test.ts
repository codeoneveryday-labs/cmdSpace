import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage = () => undefined;
  },
  invoke: mocks.invoke,
}));

import { createOrchestrationRuntime } from "./orchestrationRuntime";
import { createOrchestrationDraft } from "./orchestrationManifest";

describe("orchestrationRuntime", () => {
  it("creates a Canvas-only run with the workspace and draft manifest", async () => {
    mocks.invoke.mockResolvedValue({ id: "run-1" });
    const runtime = createOrchestrationRuntime(() => undefined);
    const manifest = createOrchestrationDraft("Build it", "codex");

    await runtime.createRun("workspace-1", "/repo", "run-1", manifest);

    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_create_run", {
      workspaceId: "workspace-1",
      cwd: "/repo",
      runId: "run-1",
      manifest,
    });
  });
});
