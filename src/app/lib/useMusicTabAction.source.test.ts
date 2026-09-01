import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useMusicTabAction.ts", import.meta.url),
  "utf8",
);

describe("useMusicTabAction contract", () => {
  it("installs the Music CLI before opening its terminal tab", () => {
    expect(source).toContain("useMusicTabAction");
    expect(source).toContain('invoke("install_music_cli_script")');
    expect(source).toContain('source "$HOME/.cmdspace/music-cli.zsh"');
    expect(source).toContain('"Music CLI"');
    expect(source).toContain("inheritedCwdForNewTab");
  });
});
