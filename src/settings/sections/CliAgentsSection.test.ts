import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sectionPath = path.join(here, "CliAgentsSection.tsx");
const settingsAppPath = path.join(here, "../SettingsApp.tsx");
const storePath = path.join(here, "../../modules/settings/store.ts");

describe("CLI Agents settings", () => {
  it("replaces persona management with a persistent CLI catalog", () => {
    const section = readFileSync(sectionPath, "utf8");
    const settingsApp = readFileSync(settingsAppPath, "utf8");
    const store = readFileSync(storePath, "utf8");

    expect(settingsApp).toContain('label: "CLI Agents"');
    expect(settingsApp).toContain("CliAgentsSection");
    expect(settingsApp).not.toContain('from "./sections/AgentsSection"');
    expect(section).toContain('invoke<boolean[]>("check_agent_clis"');
    expect(section).toContain("Search CLI agents");
    expect(section).toContain("Not installed");
    expect(section).toContain("Install instructions");
    expect(section).toContain("setCliAgentIds");
    expect(section).toContain("setDisabledCliAgentIds");
    expect(store).toContain('const KEY_CLI_AGENT_IDS = "cliAgentIds"');
    expect(store).toContain('const KEY_DISABLED_CLI_AGENT_IDS = "disabledCliAgentIds"');
  });
});
