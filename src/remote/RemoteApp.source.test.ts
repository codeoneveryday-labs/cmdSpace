import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "RemoteApp.tsx");
const passwordScreenPath = path.join(here, "RemotePasswordScreen.tsx");
const folderPickerPath = path.join(here, "RemoteFolderPicker.tsx");
const stylesPath = path.join(here, "remote.css");
const remoteHtmlPath = path.join(here, "../../remote.html");

describe("RemoteApp transport", () => {
  it("uses authenticated WebSocket terminal traffic instead of EventSource and POST input", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("RemoteTerminalClient");
    expect(source).not.toContain("new WebSocket");
    expect(source).not.toContain("new EventSource");
    expect(source).not.toContain("/input");
  });

  it("uses the same focused clsh-style terminal hierarchy on every viewport", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("RemoteSessionGrid");
    expect(source).toContain("RemoteTerminal");
    expect(source).toContain("remote-context-strip");
    expect(source).not.toContain("TerminalTile");
    expect(source).not.toContain("WorkspacesPanel");
    expect(source).not.toContain("RemoteSidebar");
    expect(source).not.toContain("WORKSPACES_PANEL_WIDTH");
  });

  it("sends terminal control bytes rather than literal escape text", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('<Shortcut label="tab" value={"\\t"} onSend={sendKey} />');
    expect(source).toContain('<Shortcut label="←" value={"\\u001b[D"} onSend={sendKey} />');
    expect(source).toContain('<Shortcut label="↓" value={"\\u001b[B"} onSend={sendKey} />');
    expect(source).toContain('<Shortcut label="↑" value={"\\u001b[A"} onSend={sendKey} />');
    expect(source).toContain('<Shortcut label="→" value={"\\u001b[C"} onSend={sendKey} />');
    expect(source).toContain('<Shortcut label="↵" value={"\\r"} onSend={sendKey} />');
  });

  it("does not send a shortcut while the user starts a horizontal swipe", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("onClick={trigger}");
    expect(source).not.toContain("onTouchStart={trigger}");
    expect(source).not.toContain("onPointerDown={trigger}");
  });

  it("allows fast repeats of distinct shortcuts while blocking duplicate spam", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("lastSentRef");
    expect(source).toContain("lastSent.value === value");
    expect(source).toContain("now - lastSent.at < 150");
    expect(source).not.toContain("lastPressedRef");
  });

  it("uses the system keyboard without redundant remote controls", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("window.visualViewport?.height");
    expect(source).toContain('style={{ height: `${viewportHeight}px` }}');
    expect(source).not.toContain('aria-label="Show system keyboard"');
    expect(source).not.toContain("terminalFocusRequest");
    expect(source).not.toContain("RemoteKeyboard");
    expect(source).not.toContain("keyboardVisible");
  });

  it("asks Chrome Android to resize content instead of overlaying the system keyboard", () => {
    const html = readFileSync(remoteHtmlPath, "utf8");

    expect(html).toContain("interactive-widget=resizes-content");
  });

  it("offers password setup or login without a temporary-code screen", () => {
    const source = readFileSync(sourcePath, "utf8");
    const passwordScreen = readFileSync(passwordScreenPath, "utf8");

    expect(source).toContain("RemotePasswordScreen");
    expect(source).toContain("cmdspace.remote.token");
    expect(passwordScreen).toContain("/api/remote/auth/status");
    expect(passwordScreen).toContain("/api/remote/auth/setup");
    expect(passwordScreen).toContain("/api/remote/auth/login");
    expect(passwordScreen).toContain("Confirm password");
    expect(source).not.toContain("RemotePairingScreen");
    expect(passwordScreen).not.toContain("Pairing code");
  });

  it("uses the cmdSpace mark and keeps password forms inside a mobile viewport", () => {
    const passwordScreen = readFileSync(passwordScreenPath, "utf8");
    const styles = readFileSync(stylesPath, "utf8");

    expect(passwordScreen).toContain('src="/logo.png"');
    expect(passwordScreen).toContain('alt="cmdSpace"');
    expect(passwordScreen).not.toContain("AiNetworkIcon");
    expect(styles).toContain(".remote-auth-card {");
    expect(styles).toContain("box-sizing: border-box;");
    expect(styles).toContain(".remote-auth-logo");
    expect(styles).toContain("border-radius: 10px;");
    expect(styles).toContain("@media (max-width: 520px)");
  });

  it("does not add a browser voice-input control when the system keyboard provides dictation", () => {
    const source = readFileSync(sourcePath, "utf8");
    const passwordScreen = readFileSync(passwordScreenPath, "utf8");
    const combined = `${source}\n${passwordScreen}`;

    expect(combined).not.toContain("webkitSpeechRecognition");
    expect(combined).not.toContain("SpeechRecognition");
    expect(combined).not.toContain("Mic01Icon");
    expect(combined).not.toContain("toggleVoiceInput");
    expect(combined).not.toContain("remote-voice-error");
  });

  it("accepts Android-safe setup paths and scrubs the one-time secret", () => {
    const passwordScreen = readFileSync(passwordScreenPath, "utf8");

    expect(passwordScreen).toContain("readRemoteBootstrapSecretFromUrl");
    expect(passwordScreen).toContain("scrubRemoteBootstrapUrl");
    expect(passwordScreen).toContain("window.history.replaceState");
  });

  it("shows a launcher home before folder selection", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("RemoteHomeScreen");
    expect(source).toContain("onAddProject");
    expect(source).toContain("onImportSession");
    expect(source).toContain("onSetupProviders");
    expect(source).toContain("setShowAddProject(true)");
    expect(source).toContain("setShowImportSession(true)");
    expect(source).toContain("setShowProviders(true)");
  });

  it("opens an add-project dialog with machine hostname before folder browsing", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("AddProjectDialog");
    expect(source).toContain('fetch("/api/remote/state"');
    expect(source).toContain("state.hostname");
    expect(source).toContain("onSearchDirectory");
  });

  it("requires file or folder selection after authentication and before terminal creation", () => {
    const source = readFileSync(sourcePath, "utf8");
    const folderPicker = readFileSync(folderPickerPath, "utf8");

    expect(source).toContain("RemoteFolderPicker");
    expect(folderPicker).toContain("getRemoteFolderView");
    expect(folderPicker).toContain('className="remote-folder-picker"');
    expect(folderPicker).toContain('className="remote-folder-picker-scroll"');
    expect(folderPicker).toContain("Open current folder");
    expect(folderPicker).not.toContain("Choose a file or folder");
    expect(folderPicker).not.toContain("mx-auto mb-5 grid size-20");
    expect(folderPicker).toContain("load(folder.path)");
    expect(folderPicker).toContain("onSelect(file.parent)");
    expect(source).toContain(
      'window.localStorage.removeItem("cmdspace.remote.cwd")',
    );
    expect(folderPicker).toContain("new AbortController()");
    expect(folderPicker).toContain("signal: request.signal");
    expect(source.indexOf("RemoteFolderPicker")).toBeLessThan(
      source.indexOf("RemoteSessionGrid"),
    );
  });

  it("filters locally and caches folder responses for low-latency navigation", () => {
    const folderPicker = readFileSync(folderPickerPath, "utf8");

    expect(folderPicker).toContain("remote-folder-search");
    expect(folderPicker).toContain("folderCacheRef");
    expect(folderPicker).toContain("folderCacheRef.current.get(path)");
    expect(folderPicker).toContain("filteredFolders");
    expect(folderPicker).toContain("filteredFiles");
  });

  it("delegates bounded terminal-create retries to the session lifecycle model", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("shouldRetryRemoteSessionCreate(");
    expect(source).not.toContain("createRequestedFor");
  });

  it("creates a dedicated terminal instead of attaching an unrelated desktop session", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("const availableSessions");
    expect(source).toContain("if (cwdSessions.length === 0)");
    expect(source).toContain("visibleRemoteSession(cwdSessions, activeSessionId)");
  });
});
