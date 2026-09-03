import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function frontendIds(): string[] {
  const source = read("src/modules/terminal/lib/cliAgents.ts");
  const block = source.split("export const DEFAULT_CONFIGURED")[0];
  return [...block.matchAll(/^  "([^"]+)",/gm)].map((m) => m[1]);
}

/**
 * Adding a CLI agent touches ~7 seams. This test fails loudly at every
 * seam a new agent missed, so the author must either wire it or record
 * a reasoned exception below.
 */
describe("CLI agent catalog parity", () => {
  it("gives every agent a brand icon", () => {
    // aider intentionally uses the generic CodeIcon fallback
    // (see FALLBACK_ICON_BY_AGENT in AgentCliIcon.tsx).
    const ICON_FALLBACK_ALLOWLIST = ["aider"];
    const brandIcons = read("src/components/brandIcons.ts");
    const missing = frontendIds().filter(
      (id) =>
        !ICON_FALLBACK_ALLOWLIST.includes(id) &&
        !new RegExp(`^\\s*"?${id}"?:`, "m").test(brandIcons),
    );
    expect(missing).toEqual([]);
  });

  it("lists every agent in the remote provider catalog", () => {
    const providers = read("src-tauri/src/modules/remote/providers.rs");
    const missing = frontendIds().filter(
      (id) => !providers.includes(`"${id}",`),
    );
    expect(missing).toEqual([]);
  });

  it("keeps frontend and native resume commands in agreement", () => {
    // Agents without a verified resume command fall back to the
    // conventional `<exe> --resume <id>` form (see the default arm in
    // buildSessionResumeCommand). Listed here explicitly so adding an
    // agent forces a decision: wire its resume command or justify why not.
    const CONVENTIONAL_FALLBACK_ALLOWLIST = [
      // Resume commands not yet verified against the real CLIs.
      "omp",
      "devin",
      "hermes",
      // Marketplace agents share the conventional fallback by design.
      "agoragentic",
      "auggie",
      "autohand",
      "codebuddy",
      "codewhale",
      "cortex",
      "corust",
      "crow",
      "deepagents",
      "dimcode",
      "dirac",
      "factory-droid",
      "fast-agent",
      "glm",
      "junie",
      "kilo",
      "minion",
      "mistral-vibe",
      "nova",
      "poolside",
      "qoder",
      "sigit",
      "stakpak",
      "trae",
      "vt-code",
    ];
    const frontend = read("src/modules/workspaces/lib/importSessions.ts");
    const native = read(
      "src-tauri/src/modules/remote/device_session_import.rs",
    );
    const frontendCases = new Set(
      [...frontend.matchAll(/case "([^"]+)":/g)].map((m) => m[1]),
    );
    const nativeArms = new Set(
      [...native.matchAll(/"([^"]+)" => format!/g)].map((m) => m[1]),
    );

    // Both sides must agree exactly.
    expect([...frontendCases].sort()).toEqual([...nativeArms].sort());

    // Every agent is either wired or explicitly allowed to fall back —
    // and the allowlist must not cover an agent that is already wired.
    const allowlist = new Set(CONVENTIONAL_FALLBACK_ALLOWLIST);
    const unwired = frontendIds().filter((id) => !frontendCases.has(id));
    expect(unwired.sort()).toEqual([...allowlist].sort());
  });
});
