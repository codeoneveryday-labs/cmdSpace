import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("menu bar workspace switcher wiring", () => {
  it("ships a dedicated Vite entry with the required Tauri capabilities", () => {
    const vite = readFileSync(path.join(root, "vite.config.ts"), "utf8");
    const html = readFileSync(path.join(root, "tray.html"), "utf8");
    const capability = readFileSync(
      path.join(root, "src-tauri/capabilities/default.json"),
      "utf8",
    );

    expect(vite).toContain('tray: path.resolve(__dirname, "tray.html")');
    expect(html).toContain('id="tray-root"');
    expect(html).toContain('src="/src/tray/main.tsx"');
    expect(capability).toContain('"tray"');
    expect(capability).toContain('"core:window:allow-hide"');
  });

  it("refreshes SQLite workspaces whenever the native popup opens", () => {
    const source = readFileSync(
      path.join(root, "src/tray/WorkspaceSwitcher.tsx"),
      "utf8",
    );

    expect(source).toContain('invoke<TrayWorkspace[]>("db_list_workspaces")');
    expect(source).toContain('listen("cmdspace:tray-opened"');
    expect(source).toContain("onFocusChanged");
    expect(source).toContain('invoke("hide_workspace_switcher")');
    expect(source).toContain('invoke("open_workspace_from_tray"');
    expect(source).toContain('aria-label="Search workspaces"');
    expect(source).toContain('aria-label="Workspace results"');
  });

  it("shows compact usage only for enabled providers that report data", () => {
    const source = readFileSync(
      path.join(root, "src/tray/WorkspaceSwitcher.tsx"),
      "utf8",
    );

    expect(source).toContain("getEnabledCliAgentDefinitions");
    expect(source).toContain("loadPreferences");
    expect(source).toContain(
      'invoke<ProviderLimitStatus | null>(\n            "provider_limit_status"',
    );
    expect(source).toContain("pendingProviders.has(agent.id)");
    expect(source).toContain("usageAgents.map((agent) => {");
    expect(source).toContain("Provider usage");
    expect(source).toContain("h-0.5 overflow-hidden rounded-full bg-border/60");
    expect(source).toContain('role="progressbar"');
    expect(source).not.toContain(
      'invoke<ProviderLimitStatus[]>("provider_limit_statuses")',
    );
  });

  it("renders a clean floating panel without a protruding tray arrow", () => {
    const source = readFileSync(
      path.join(root, "src/tray/WorkspaceSwitcher.tsx"),
      "utf8",
    );

    expect(source).toContain("bg-transparent p-3 text-foreground");
    expect(source).toContain("rounded-[18px]");
    expect(source).toContain(
      "shadow-[0_6px_16px_-8px_rgba(15,23,42,0.38)]",
    );
    expect(source).not.toContain("rotate-45");
    expect(source).not.toContain("border-l border-t");
    expect(source).not.toContain("shadow-2xl shadow-black/25");
  });

  it("isolates the transparent tray window from app background layers", () => {
    const source = readFileSync(
      path.join(root, "src/tray/WorkspaceSwitcher.tsx"),
      "utf8",
    );
    const entry = readFileSync(path.join(root, "src/tray/main.tsx"), "utf8");
    const theme = readFileSync(
      path.join(root, "src/modules/theme/ThemeProvider.tsx"),
      "utf8",
    );
    const styles = readFileSync(path.join(root, "src/styles/globals.css"), "utf8");

    expect(entry).toContain("document.documentElement.dataset.trayWindow = \"true\"");
    expect(entry).toContain("<ThemeProvider surfaceLayer={false}>");
    expect(theme).toContain("surfaceLayer?: boolean");
    expect(theme).toContain("surfaceLayer = true");
    expect(source).toContain("tray-panel");
    expect(styles).toContain('html[data-tray-window] body');
    expect(styles).toContain(".tray-panel");
  });

  it("hands selection to the existing main-window workspace callback", () => {
    const app = readFileSync(path.join(root, "src/app/App.tsx"), "utf8");
    const tauri = readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8");

    expect(app).toContain("workspaceSelectionRequestRef");
    expect(app).toContain("handleSelectWorkspaceRef.current(event.payload)");
    expect(app).toContain('listen<string>("cmdspace:open-workspace"');
    expect(tauri).toContain("TrayIconBuilder::with_id(WORKSPACE_TRAY_ID)");
    expect(tauri).toContain('WebviewUrl::App("tray.html".into())');
    expect(tauri).toContain('"cmdspace:tray-opened"');
    expect(tauri).toContain('main.emit("cmdspace:open-workspace", workspace_id)');
  });

  it("uses the transparent monochrome menu bar asset instead of the app icon", () => {
    const tauri = readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8");

    expect(existsSync(path.join(root, "src-tauri/icons/trayTemplate.png"))).toBe(
      true,
    );
    expect(tauri).toContain(
      'tauri::include_image!("icons/trayTemplate.png")',
    );
    expect(tauri).not.toContain("app.default_window_icon().cloned()");
  });
});
