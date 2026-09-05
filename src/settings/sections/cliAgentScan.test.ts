import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInstalledCliAgents,
  resetCliAgentScanCacheForTests,
} from "./cliAgentScan";

describe("CLI agent scan cache", () => {
  beforeEach(() => {
    resetCliAgentScanCacheForTests();
  });

  it("reuses the first scan when the CLI settings tab remounts", async () => {
    const scan = vi.fn().mockResolvedValue([true, false]);

    await checkInstalledCliAgents(["claude", "codex"], scan);
    await checkInstalledCliAgents(["claude", "codex"], scan);

    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("reuses an in-flight scan across concurrent mounts", async () => {
    let resolveScan: (value: boolean[]) => void = () => undefined;
    const scan = vi.fn(
      () => new Promise<boolean[]>((resolve) => {
        resolveScan = resolve;
      }),
    );

    const first = checkInstalledCliAgents(["claude", "codex"], scan);
    const second = checkInstalledCliAgents(["claude", "codex"], scan);
    resolveScan([true, false]);

    await expect(Promise.all([first, second])).resolves.toEqual([
      [true, false],
      [true, false],
    ]);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("runs a fresh scan when refresh is requested", async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce([true, false])
      .mockResolvedValueOnce([true, true]);

    await checkInstalledCliAgents(["claude", "codex"], scan);
    const refreshed = await checkInstalledCliAgents(
      ["claude", "codex"],
      scan,
      true,
    );

    expect(refreshed).toEqual([true, true]);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("keeps the refreshed result when an older scan resolves later", async () => {
    let resolveFirst: (value: boolean[]) => void = () => undefined;
    let resolveSecond: (value: boolean[]) => void = () => undefined;
    const scan = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<boolean[]>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockImplementationOnce(
        () => new Promise<boolean[]>((resolve) => {
          resolveSecond = resolve;
        }),
      );

    const first = checkInstalledCliAgents(["claude"], scan);
    const refreshed = checkInstalledCliAgents(["claude"], scan, true);
    resolveSecond([true]);
    await refreshed;
    resolveFirst([false]);
    await first;

    await expect(checkInstalledCliAgents(["claude"], scan)).resolves.toEqual([
      true,
    ]);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed scans", async () => {
    const scan = vi
      .fn()
      .mockRejectedValueOnce(new Error("scan failed"))
      .mockResolvedValueOnce([true]);

    await expect(checkInstalledCliAgents(["claude"], scan)).rejects.toThrow(
      "scan failed",
    );
    await expect(checkInstalledCliAgents(["claude"], scan)).resolves.toEqual([
      true,
    ]);
    expect(scan).toHaveBeenCalledTimes(2);
  });
});
