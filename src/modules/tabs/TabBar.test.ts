import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const tabBarPath = path.join(here, "TabBar.tsx");
const useTabsPath = path.join(here, "lib/useTabs.ts");
const headerPath = path.join(here, "../header/Header.tsx");
const appPath = path.join(here, "../../app/App.tsx");

describe("TabBar drag reorder", () => {
  it("keeps tabs draggable without making the tab strip a window drag region", () => {
    const tabBarSource = readFileSync(tabBarPath, "utf8");
    const useTabsSource = readFileSync(useTabsPath, "utf8");
    const headerSource = readFileSync(headerPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(useTabsSource).toContain("const reorderTab");
    expect(useTabsSource).toContain('placement: "before" | "after" = "before"');
    expect(useTabsSource).toContain("next.splice(insertAt, 0, dragged)");
    expect(tabBarSource).toContain("onPointerDown");
    expect(tabBarSource).toContain('window.addEventListener("pointermove"');
    expect(tabBarSource).toContain("previewIndexForPointer");
    expect(tabBarSource).toContain("drag-placeholder");
    expect(tabBarSource).toContain("pointer-events-none fixed z-50");
    expect(tabBarSource).toContain("onReorder(");
    expect(tabBarSource).toContain('drag.previewIndex >= siblings.length ? "after" : "before"');
    expect(tabBarSource).not.toContain("onDragStart");
    expect(tabBarSource).not.toContain("draggable");
    expect(tabBarSource).not.toContain("cursor-grab");
    expect(tabBarSource).not.toContain("cursor-grabbing");
    expect(tabBarSource).toContain("cursor-default");
    expect(headerSource).toContain("onReorder");
    expect(appSource).toContain("reorderTab");
    expect(tabBarSource).not.toContain("data-tauri-drag-region");
    expect(headerSource).toContain(
      '<div data-tauri-drag-region className="h-full min-w-2 flex-1" />',
    );
  });

  it("gives the blank window drag region the full header height", () => {
    const headerSource = readFileSync(headerPath, "utf8");

    expect(headerSource).toContain(
      'className="flex h-full min-w-0 flex-1 items-center gap-2"',
    );
    expect(headerSource).toContain('className="h-full min-w-2 flex-1"');
  });

  it("keeps new-tab shortcut labels aligned in a compact column", () => {
    const tabBarSource = readFileSync(tabBarPath, "utf8");

    expect(tabBarSource).toContain("function NewTabMenuItem");
    expect(tabBarSource).toContain('className="min-w-48"');
    expect(tabBarSource).toContain("grid-cols-[22px_1fr_48px]");
    expect(tabBarSource).toContain("text-right text-[11px]");
    expect(tabBarSource).toContain("tabular-nums");
  });

  it("dims Git Graph when the active workspace is not a Git repository", () => {
    const tabBarSource = readFileSync(tabBarPath, "utf8");
    const headerSource = readFileSync(headerPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(tabBarSource).toContain("canNewGitGraph: boolean");
    expect(tabBarSource).toContain("disabled={!canNewGitGraph}");
    expect(tabBarSource).toContain('title={canNewGitGraph ? undefined : "No Git repository"}');
    expect(tabBarSource).toContain("disabled:opacity-40");
    expect(headerSource).toContain("canNewGitGraph: boolean");
    expect(headerSource).toContain("canNewGitGraph={canNewGitGraph}");
    expect(appSource).toContain("canNewGitGraph={sourceControl.hasRepo}");
    expect(appSource).toContain('if (id === "tab.newGitGraph")');
    expect(appSource).toContain("return !sourceControl.hasRepo;");
  });
});
