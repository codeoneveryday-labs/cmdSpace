import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sessionPath = path.join(here, "useTerminalSession.ts");

describe("terminal agent replacement lifecycle", () => {
  it("replaces the launch command on the existing session", () => {
    const source = readFileSync(sessionPath, "utf8");

    expect(source).toContain("export async function replaceSessionCommand");
    expect(source).toContain("session.launchCommand = command ?? undefined");
    expect(source).toContain(
      "setAgentCliCommand(leafId, command ?? undefined)",
    );
    expect(source).toContain(
      "await respawnSession(leafId, cwd, Boolean(command))",
    );
  });
});
