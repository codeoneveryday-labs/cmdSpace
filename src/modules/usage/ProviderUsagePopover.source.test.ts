import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "ProviderUsagePopover.tsx");
const tauriLibPath = path.join(here, "../../../src-tauri/src/lib.rs");

describe("ProviderUsagePopover", () => {
  it("loads each provider independently and skeletonizes only pending cards", () => {
    const source = readFileSync(sourcePath, "utf8");
    const tauriLib = readFileSync(tauriLibPath, "utf8");

    expect(source).toContain("invoke<ProviderLimitStatus | null>(");
    expect(source).toContain('"provider_limit_status",');
    expect(tauriLib).toContain("agent_usage::provider_limit_status,");
    expect(source).toContain("getEnabledCliAgentDefinitions");
    expect(source).toContain("USAGE_TRACKED_CLI_AGENT_IDS");
    expect(source).toContain(".filter((agent) => USAGE_TRACKED_CLI_AGENT_IDS.has(agent.id))");
    expect(source).toContain("loadPreferences");
    expect(source).toContain("pendingProviders.has(agent.id)");
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("<Skeleton");
    expect(source).not.toContain("loading={loading}");
    expect(source).not.toContain("loading && !status");
    expect(source).toContain("supported signed-in provider data");
    expect(source).toContain("No usage or account limit reported locally yet");
    expect(source).toContain("const preferences = await loadPreferences()");
    expect(source).toContain("status.accountUsage");
    expect(source).toContain("formatCredits(status.accountUsage.creditsRemaining)");
    expect(source).toContain("requests");
    expect(source).not.toContain("contextTokens");
  });
});
