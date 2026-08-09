import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sidebarBrowserPath = path.join(here, "SidebarBrowserPane.tsx");
const addressBarPath = path.join(here, "PreviewAddressBar.tsx");
const previewConstantsPath = path.join(here, "constants.ts");

describe("Sidebar browser toolbar", () => {
  it("renders browser-style back and forward controls in the address bar", () => {
    const source = readFileSync(addressBarPath, "utf8");
    expect(source).toContain("ArrowLeft01Icon");
    expect(source).toContain("ArrowRight01Icon");
    expect(source).toContain('title="Back"');
    expect(source).toContain('title="Forward"');
    expect(source).toContain("disabled={!canGoBack}");
    expect(source).toContain("disabled={!canGoForward}");
  });

  it("keeps local navigation history for sidebar browser URLs", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");
    expect(source).toContain("const [history, setHistory]");
    expect(source).toContain("const [historyIndex, setHistoryIndex]");
    expect(source).toContain("const handleBack");
    expect(source).toContain("const handleForward");
    expect(source).toContain("const [reloadNonce, setReloadNonce]");
  });

  it("uses a native Tauri child webview so public sites are not iframe-blocked", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");
    expect(source).toContain('@tauri-apps/api/webview');
    expect(source).toContain("new Webview");
    expect(source).toContain("getCurrentWindow()");
    expect(source).toContain("setPosition");
    expect(source).toContain("setSize");
    expect(source).toContain("webviewRef");
  });

  it("enables the native webview runtime instead of forcing the iframe fallback", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");
    expect(source).toMatch(
      /const useNativeWebview = hasTauriWebviewRuntime\(\);/,
    );
    expect(source).not.toContain("false && hasTauriWebviewRuntime()");
  });

  it("hides the native webview while the sidebar is resizing", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");

    expect(source).toContain("const nativeInteractionBlocked = nativeLayerBlocked || resizing;");
    expect(source).toContain("!visible || !normalizedUrl || nativeInteractionBlocked");
    expect(source).not.toContain("!visible || !normalizedUrl || resizing");
  });

  it("hides the native webview while a blocking dialog is open", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");

    expect(source).toContain("const nativeLayerBlocked = useNativeLayerBlocker();");
    expect(source).toContain("const nativeInteractionBlocked = nativeLayerBlocked || resizing;");
    expect(source).toContain("!visible || !normalizedUrl || nativeInteractionBlocked");
    expect(source).toContain("[data-slot=\"dialog-content\"][data-state=\"open\"]");
    expect(source).toContain("[role=\"dialog\"][data-state=\"open\"]");
    expect(source).toContain("[role=\"alertdialog\"][data-state=\"open\"]");
    expect(source).toContain("new MutationObserver");
  });

  it("keeps an iframe fallback for non-Tauri browser development", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");
    expect(source).toContain("<iframe");
    expect(source).toContain('title="Sidebar browser"');
    expect(source).toContain("useNativeWebview");
  });

  it("keeps shared preview constants out of the address bar component", () => {
    const addressSource = readFileSync(addressBarPath, "utf8");
    const constantsSource = readFileSync(previewConstantsPath, "utf8");

    expect(constantsSource).toContain("export const PORT_PRESETS");
    expect(constantsSource).toContain("export const PREVIEW_SUSPEND_AFTER_MS");
    expect(addressSource).not.toContain("const PORT_PRESETS");
  });

  it("does not let the browser iframe intercept sidebar resize drags", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");

    expect(source).toContain("resizing?: boolean;");
    expect(source).toContain("resizing = false");
    expect(source).toContain('resizing && "pointer-events-none"');
    expect(source).toContain("{resizing ? (");
    expect(source).toContain("cursor-col-resize");
  });

  it("resynchronizes native bounds when a canvas transform changes", () => {
    const source = readFileSync(sidebarBrowserPath, "utf8");

    expect(source).toContain("boundsRevision?: string | number;");
    expect(source).toContain("boundsRevision,");
    expect(source).toContain("[boundsRevision, syncNativeBounds, useNativeWebview]");
  });
});
