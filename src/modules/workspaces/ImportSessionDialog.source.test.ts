import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("workspace session import wiring", () => {
  it("lists native sessions and resumes the selected one in the active workspace", () => {
    const dialog = readFileSync(path.join(here, "ImportSessionDialog.tsx"), "utf8");
    const dialogModel = readFileSync(
      path.join(here, "lib/importSessionDialogModel.ts"),
      "utf8",
    );
    const panel = [
      readFileSync(path.join(here, "WorkspacesPanel.tsx"), "utf8"),
      readFileSync(path.join(here, "WorkspacePanelHeader.tsx"), "utf8"),
      readFileSync(path.join(here, "WorkspaceSetupView.tsx"), "utf8"),
      readFileSync(path.join(here, "WorkspaceSetupAgentsStep.tsx"), "utf8"),
      readFileSync(
        path.join(here, "WorkspaceAgentAssignmentSummary.tsx"),
        "utf8",
      ),
      readFileSync(
        path.join(here, "lib/useWorkspaceSetupAgentCapacity.ts"),
        "utf8",
      ),
      readFileSync(
        path.join(here, "lib/useWorkspaceSetupCommandPersistence.ts"),
        "utf8",
      ),
      readFileSync(path.join(here, "lib/workspaceSetupModel.ts"), "utf8"),
      readFileSync(
        path.join(here, "lib/useWorkspaceSetupImportSelection.ts"),
        "utf8",
      ),
    ].join("\n");
    const workspaceController = readFileSync(
      path.join(here, "../../app/lib/useWorkspaceController.ts"),
      "utf8",
    );
    const tauri = readFileSync(path.join(here, "../../../src-tauri/src/commands.rs"), "utf8");
    const extendedDiscovery = readFileSync(
      path.join(
        here,
        "../../../src-tauri/src/modules/pty/session_import/extended.rs",
      ),
      "utf8",
    );

    expect(dialog).toContain('"list_agent_sessions"');
    expect(dialog).toContain("{ limit: 200, workspaceCwd }");
    expect(dialog).toContain("Current workspace");
    expect(dialog).toContain("All sessions");
    expect(dialog).toContain("Active in another Codex window");
    expect(dialog).toContain("multiple?: boolean");
    expect(dialog).toContain("onImportMany");
    expect(dialog).toContain("selectedSessionKeys");
    expect(dialog).toContain("aria-pressed={selected}");
    expect(dialog).toContain("selectedSessionLabel");
    expect(dialog).toContain('aria-label="Filter sessions by agent"');
    expect(dialog).toContain("deriveImportSessionDialogModel");
    expect(dialog).toContain("importSessionKey");
    expect(dialogModel).toContain("sessionProviderCounts");
    expect(dialogModel).toContain("filterImportableSessions");
    expect(dialog).toContain("getEnabledCliAgentDefinitions");
    expect(dialogModel).toContain("sessionsForEnabledProviders");
    expect(dialog).toContain("disabledCliAgentIds");
    expect(dialog).toContain("All agents");
    expect(dialog).toContain("Add ${selectedSessions.length} ${selectedSessionLabel}");
    expect(dialog).toContain("formatRelativeActivity(session.lastActivityAt)");
    expect(dialog).toContain("title={session.title}");
    expect(dialog).toContain("title={session.preview ?? undefined}");
    expect(dialog).toContain("<AgentCliIcon agent={session.provider}");
    expect(panel).toContain("Import agent session");
    expect(panel).toContain("Import existing session");
    expect(panel).toContain("selectedImportSessions");
    expect(panel).toContain("regularTerminalCount");
    expect(panel).toContain("Regular terminals");
    expect(panel).toContain("selectImportSessions");
    expect(panel).toContain("multiple");
    expect(panel).toContain("onImportMany: selectImportSessions");
    expect(panel).toContain("<ImportSessionDialog");
    expect(panel).toContain("buildSessionResumeCommand");
    expect(workspaceController).toContain("buildSessionResumeCommand");
    expect(workspaceController).toContain("appendTerminalPane");
    expect(workspaceController).toContain("input.updateCanvasDiagram(tab.id, nextDiagram)");
    expect(tauri).toContain("pty::list_agent_sessions");
    expect(extendedDiscovery).not.toContain("amp threads list");
    expect(extendedDiscovery).not.toContain("qwen sessions list");
    expect(extendedDiscovery).not.toContain("Command::new");
  });
});
