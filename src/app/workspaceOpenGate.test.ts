import { describe, expect, it, vi } from "vitest";

import { createWorkspaceOpenGate } from "./workspaceOpenGate";

describe("createWorkspaceOpenGate", () => {
  it("coalesces duplicate tray events while a workspace is opening", async () => {
    let finishOpen!: () => void;
    const open = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishOpen = resolve;
        }),
    );
    const gate = createWorkspaceOpenGate();

    const attempts = Array.from({ length: 58 }, () =>
      gate.open("workspace-02", open),
    );

    expect(open).toHaveBeenCalledTimes(1);
    finishOpen();
    expect(await Promise.all(attempts)).toEqual([
      true,
      ...Array.from({ length: 57 }, () => false),
    ]);

    const reopen = vi.fn(async () => undefined);
    await gate.open("workspace-02", reopen);
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(gate.isOpening("workspace-02")).toBe(false);
  });
});
