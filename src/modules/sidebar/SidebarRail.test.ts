import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sidebarRailPath = path.join(here, "SidebarRail.tsx");
const appPath = path.join(here, "../../app/App.tsx");

describe("sidebar rails", () => {
  it("does not duplicate the main sidebar rail at the bottom", () => {
    const appSource = readFileSync(appPath, "utf8");
    const mainRailUses = appSource.match(/<SidebarRail\b/g) ?? [];
    expect(mainRailUses).toHaveLength(1);
    expect(appSource).toContain("<EditorSidebarRail");
    expect(appSource).toContain("<SourceControlPanel");
  });

  it("uses Files and Source Control as the editor bottom rail", () => {
    const railSource = readFileSync(sidebarRailPath, "utf8");
    expect(railSource).toContain('label: "Files"');
    expect(railSource).toContain('label: "Source Control"');
    expect(railSource).toContain('id: "source-control"');
  });

  it("uses a web globe icon for the browser rail tab", () => {
    const railSource = readFileSync(sidebarRailPath, "utf8");

    expect(railSource).toContain("Globe02Icon");
    expect(railSource).toContain('{ id: "browser", label: "Browser", icon: Globe02Icon }');
    expect(railSource).not.toContain("BrowserIcon");
  });

  it("limits the main rail to browser and editor tabs", () => {
    const railSource = readFileSync(sidebarRailPath, "utf8");

    expect(railSource).toContain('{ id: "browser", label: "Browser", icon: Globe02Icon }');
    expect(railSource).toContain('{ id: "editor", label: "Editor", icon: CodeIcon }');
    expect(railSource).not.toContain('id: "helper"');
    expect(railSource).not.toContain('label: "Helper"');
    expect(railSource).not.toContain("AiChat02Icon");
  });
});
