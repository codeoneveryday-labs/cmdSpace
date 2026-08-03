import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const scriptPath = path.join(repoRoot, "scripts/music-cli.zsh");
const homes: string[] = [];

function runZsh(command: string): string {
  const home = mkdtempSync(path.join(tmpdir(), "cmdspace-music-cli-"));
  homes.push(home);
  return execFileSync("zsh", ["-dfc", command], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, MUSIC_CLI_TEST_SCRIPT: scriptPath },
  });
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe("Music CLI shell entrypoint", () => {
  it("dispatches subcommands even when invoked in the same parse as source", () => {
    const output = runZsh(
      'source "$MUSIC_CLI_TEST_SCRIPT" >/dev/null; whence -w mcli; mcli recent',
    );

    expect(output).toContain("mcli: function");
    expect(output).toContain("No recently played music yet");
  });

  it("stops immediately when song input is interrupted", () => {
    const output = runZsh(`
      source "$MUSIC_CLI_TEST_SCRIPT" >/dev/null
      read() { typeset -g "$2=partial-ime-input"; return 130 }
      mcli
      printf "exit:%s\\n" "$?"
    `);

    expect(output).toContain("Search cancelled.");
    expect(output).toContain("exit:130");
    expect(output).not.toContain("No results found.");
  });
});
