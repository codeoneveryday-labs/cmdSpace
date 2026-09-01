import { describe, expect, it, vi } from "vitest";

import {
  setNativeAutostartEnabled,
  synchronizeNativeAutostartPreference,
} from "./autostartPreferenceAdapter";

describe("native autostart preference adapter", () => {
  it("persists the native setting only when it differs from the current preference", async () => {
    const persist = vi.fn(async () => undefined);

    await expect(
      synchronizeNativeAutostartPreference({
        isEnabled: async () => true,
        currentPreference: () => false,
        persist,
      }),
    ).resolves.toBe(true);
    expect(persist).toHaveBeenCalledWith(true);
  });

  it("does not overwrite a matching persisted setting", async () => {
    const persist = vi.fn(async () => undefined);

    await expect(
      synchronizeNativeAutostartPreference({
        isEnabled: async () => true,
        currentPreference: () => true,
        persist,
      }),
    ).resolves.toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not persist after the caller has become inactive", async () => {
    const persist = vi.fn(async () => undefined);

    await expect(
      synchronizeNativeAutostartPreference({
        isEnabled: async () => true,
        currentPreference: () => null,
        persist,
      }),
    ).resolves.toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it("enables native autostart before persisting an enabled preference", async () => {
    const calls: string[] = [];

    await setNativeAutostartEnabled(
      {
        enable: async () => {
          calls.push("enable");
        },
        disable: async () => {
          calls.push("disable");
        },
        persist: async () => {
          calls.push("persist");
        },
      },
      true,
    );

    expect(calls).toEqual(["enable", "persist"]);
  });

  it("leaves persistence untouched when the native toggle fails", async () => {
    const persist = vi.fn(async () => undefined);

    await expect(
      setNativeAutostartEnabled(
        {
          enable: async () => {
            throw new Error("native failure");
          },
          disable: async () => undefined,
          persist,
        },
        true,
      ),
    ).rejects.toThrow("native failure");
    expect(persist).not.toHaveBeenCalled();
  });
});
