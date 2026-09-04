import type { SearchAddon } from "@xterm/addon-search";
import { describe, expect, it, vi } from "vitest";

import type { TerminalPaneHandle } from "@/modules/terminal/TerminalPane";
import type { TerminalTab } from "@/modules/tabs";

import { createPaneBundles } from "./usePaneBundles";

function makeHandle(label: string): TerminalPaneHandle {
  return {
    write: () => undefined,
    replaceInput: () => true,
    replaceCurrentInput: () => true,
    focus: () => undefined,
    getSessionStartedAt: () => 1,
    getBuffer: () => label,
    getSelection: () => label,
  };
}

function makeTerminalTab(id: number, leafId: number): TerminalTab {
  return {
    id,
    kind: "terminal",
    title: `Terminal ${id}`,
    activeLeafId: leafId,
    paneTree: { kind: "leaf", id: leafId, cwd: `/tmp/${leafId}` },
  };
}

describe("createPaneBundles", () => {
  it("returns one stable bundle per leaf and keeps the local handle in sync", () => {
    const registerHandle = vi.fn();
    const registry = createPaneBundles({
      registerHandle,
      onSearchReady: vi.fn(),
      onCwd: vi.fn(),
      onExit: vi.fn(),
    });

    const first = registry.getBundle(11);
    const second = registry.getBundle(11);
    const other = registry.getBundle(12);
    const handle = makeHandle("leaf-11");

    expect(second).toBe(first);
    expect(other).not.toBe(first);
    expect(first.getRef()).toBeNull();

    first.setRef(handle);
    expect(first.getRef()).toBe(handle);
    expect(registerHandle).toHaveBeenNthCalledWith(1, 11, handle);

    first.setRef(null);
    expect(first.getRef()).toBeNull();
    expect(registerHandle).toHaveBeenNthCalledWith(2, 11, null);
  });

  it("routes bundle callbacks through the latest callback set after updates", () => {
    const searchA = vi.fn();
    const cwdA = vi.fn();
    const exitA = vi.fn();
    const commandA = vi.fn();
    const registry = createPaneBundles({
      registerHandle: vi.fn(),
      onSearchReady: searchA,
      onCwd: cwdA,
      onExit: exitA,
      onCommand: commandA,
    });
    const bundle = registry.getBundle(7);
    const addon = {} as SearchAddon;

    bundle.onSearch(addon);
    bundle.onCwd("/tmp/original");
    bundle.onExit(9);
    bundle.onCommand?.("claude");

    expect(searchA).toHaveBeenCalledWith(7, addon);
    expect(cwdA).toHaveBeenCalledWith(7, "/tmp/original");
    expect(exitA).toHaveBeenCalledWith(7, 9);
    expect(commandA).toHaveBeenCalledWith(7, "claude");

    const searchB = vi.fn();
    const cwdB = vi.fn();
    const exitB = vi.fn();
    registry.updateCallbacks({
      registerHandle: vi.fn(),
      onSearchReady: searchB,
      onCwd: cwdB,
      onExit: exitB,
    });

    bundle.onSearch(addon);
    bundle.onCwd("/tmp/updated");
    bundle.onExit(10);
    bundle.onCommand?.("codex");

    expect(searchA).toHaveBeenCalledTimes(1);
    expect(cwdA).toHaveBeenCalledTimes(1);
    expect(exitA).toHaveBeenCalledTimes(1);
    expect(commandA).toHaveBeenCalledTimes(1);
    expect(searchB).toHaveBeenCalledWith(7, addon);
    expect(cwdB).toHaveBeenCalledWith(7, "/tmp/updated");
    expect(exitB).toHaveBeenCalledWith(7, 10);
  });

  it("prunes bundles for leaves no longer present in any terminal tab", () => {
    const registry = createPaneBundles({
      registerHandle: vi.fn(),
      onSearchReady: vi.fn(),
      onCwd: vi.fn(),
      onExit: vi.fn(),
    });

    const retained = registry.getBundle(1);
    const pruned = registry.getBundle(2);
    const inactiveButLive = registry.getBundle(3);

    registry.prune([
      makeTerminalTab(10, 1),
      makeTerminalTab(11, 3),
    ]);

    expect(registry.getBundle(1)).toBe(retained);
    expect(registry.getBundle(3)).toBe(inactiveButLive);
    expect(registry.getBundle(2)).not.toBe(pruned);
  });
});
