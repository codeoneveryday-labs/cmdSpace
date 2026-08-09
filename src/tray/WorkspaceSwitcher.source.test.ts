import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("menu bar workspace switcher wiring", () => {
  it("ships a dedicated Vite entry with the required Tauri capabilities", () => {
    const vite = readFileSync(path.join(root, "vite.config.ts"), "utf8");
    const builtViteConfig = readFileSync(
      path.join(root, "vite.config.js"),
      "utf8",
    );
    const html = readFileSync(path.join(root, "tray.html"), "utf8");
    const capability = readFileSync(
      path.join(root, "src-tauri/capabilities/default.json"),
      "utf8",
    );

    expect(vite).toContain('tray: path.resolve(__dirname, "tray.html")');
    expect(builtViteConfig).toContain(
      'tray: path.resolve(__dirname, "tray.html")',
    );
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

  it("hands selection to the existing main-window workspace callback", () => {
    const app = readFileSync(path.join(root, "src/app/App.tsx"), "utf8");
    const tauri = readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8");

    expect(app).toContain('listen<string>("cmdspace:open-workspace"');
    expect(app).toContain("handleSelectWorkspace(event.payload)");
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
