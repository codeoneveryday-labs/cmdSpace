import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("workspace session import wiring", () => {
  it("lists native sessions and resumes the selected one in the active workspace", () => {
    const dialog = readFileSync(path.join(here, "ImportSessionDialog.tsx"), "utf8");
    const panel = readFileSync(path.join(here, "WorkspacesPanel.tsx"), "utf8");
    const app = readFileSync(path.join(here, "../../app/App.tsx"), "utf8");
    const tauri = readFileSync(path.join(here, "../../../src-tauri/src/lib.rs"), "utf8");

    expect(dialog).toContain('"list_agent_sessions"');
    expect(dialog).toContain("Current workspace");
    expect(dialog).toContain("All sessions");
    expect(dialog).toContain("Active in another Codex window");
    expect(dialog).toContain("multiple?: boolean");
    expect(dialog).toContain("onImportMany");
    expect(dialog).toContain("selectedSessionKeys");
    expect(dialog).toContain("aria-pressed={selected}");
    expect(dialog).toContain("selectedSessionLabel");
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
    expect(panel).toContain("onImportMany={selectImportSessions}");
    expect(panel).toContain("<ImportSessionDialog");
    expect(panel).toContain("buildSessionResumeCommand");
    expect(app).toContain("buildSessionResumeCommand");
    expect(app).toContain("appendTerminalPane");
    expect(app).toContain("handleArchitectureDiagramChange(tab.id, nextDiagram)");
    expect(tauri).toContain("pty::list_agent_sessions");
  });
});
