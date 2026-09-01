import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspacePaneSessionSync.ts", import.meta.url),
  "utf8",
);

describe("useWorkspacePaneSessionSync contract", () => {
  it("owns session discovery, claim dedupe, persistence and delayed retries", () => {
    expect(source).toContain("useWorkspacePaneSessionSync");
    expect(source).toContain('invoke<WorkspaceSelectionPane[]>("db_list_panes"');
    expect(source).toContain('invoke<ImportableAgentSession[]>("list_agent_sessions"');
    expect(source).toContain("assignSessionsToPanes");
    expect(source).toContain("claimedSessionIds");
    expect(source).toContain("reservedNativeSessionIdsRef");
    expect(source).toContain("persistPaneRecord");
    expect(source).toContain("[1_200, 4_000]");
    expect(source).toContain("window.clearTimeout(timer)");
  });
});
