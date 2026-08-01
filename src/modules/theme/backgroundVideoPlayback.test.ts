import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const playbackPath = path.join(here, "backgroundVideoPlayback.ts");

describe("background video playback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries rejected autoplay until the video starts playing", async () => {
    expect(existsSync(playbackPath)).toBe(true);
    if (!existsSync(playbackPath)) return;

    vi.useFakeTimers();
    const modulePath = "./backgroundVideoPlayback";
    const { startBackgroundVideoPlayback } = await import(modulePath);
    const listeners = new Map<string, Set<() => void>>();
    let attempts = 0;
    const operations: string[] = [];
    const video = {
      defaultMuted: false,
      muted: false,
      autoplay: false,
      loop: false,
      playsInline: false,
      paused: true,
      src: "",
      setAttribute: vi.fn((name: string) => operations.push(`attr:${name}`)),
      load: vi.fn(() => operations.push("load")),
      addEventListener: (name: string, listener: () => void) => {
        const bucket = listeners.get(name) ?? new Set<() => void>();
        bucket.add(listener);
        listeners.set(name, bucket);
      },
      removeEventListener: (name: string, listener: () => void) => {
        listeners.get(name)?.delete(listener);
      },
      play: vi.fn(async () => {
        operations.push("play");
        expect(video.defaultMuted).toBe(true);
        expect(video.muted).toBe(true);
        expect(video.src).toBe("blob:background-video");
        attempts += 1;
        if (attempts < 3) throw new Error("autoplay temporarily blocked");
        video.paused = false;
        listeners.get("playing")?.forEach((listener) => listener());
      }),
    };

    const playback = startBackgroundVideoPlayback(
      video as unknown as HTMLVideoElement,
      "blob:background-video",
    );
    await vi.advanceTimersByTimeAsync(1_000);

    expect(video.play).toHaveBeenCalledTimes(3);
    expect(video.paused).toBe(false);
    expect(video.defaultMuted).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.setAttribute).toHaveBeenCalledWith("muted", "");
    expect(operations.slice(0, 3)).toEqual(["attr:muted", "load", "play"]);

    playback.dispose();
  });
});
