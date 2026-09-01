import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useTabBarMusicState.ts", import.meta.url),
  "utf8",
);

describe("useTabBarMusicState contract", () => {
  it("owns Music CLI polling and interval cleanup", () => {
    expect(source).toContain('invoke<boolean>("music_is_playing")');
    expect(source).toContain("window.setInterval(refresh, 2_000)");
    expect(source).toContain("window.clearInterval(intervalId)");
    expect(source).toContain("setIsPlaying(false)");
  });
});
