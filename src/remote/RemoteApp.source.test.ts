import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "RemoteApp.tsx");
const stylesPath = path.join(here, "remote.css");

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
    expect(source).toContain("RemoteKeyboard");
    expect(source).toContain("remote-context-strip");
    expect(source).not.toContain("TerminalTile");
    expect(source).not.toContain("WorkspacesPanel");
    expect(source).not.toContain("RemoteSidebar");
    expect(source).not.toContain("WORKSPACES_PANEL_WIDTH");
  });

  it("offers password setup or login without a temporary-code screen", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("RemotePasswordScreen");
    expect(source).toContain("cmdspace.remote.token");
    expect(source).toContain("/api/remote/auth/status");
    expect(source).toContain("/api/remote/auth/setup");
    expect(source).toContain("/api/remote/auth/login");
    expect(source).toContain("Confirm password");
    expect(source).not.toContain("RemotePairingScreen");
    expect(source).not.toContain("Pairing code");
  });

  it("uses the cmdSpace mark and keeps password forms inside a mobile viewport", () => {
    const source = readFileSync(sourcePath, "utf8");
    const styles = readFileSync(stylesPath, "utf8");

    expect(source).toContain('src="/logo.png"');
    expect(source).toContain('alt="cmdSpace"');
    expect(source).not.toContain("AiNetworkIcon");
    expect(styles).toContain(".remote-auth-card {");
    expect(styles).toContain("box-sizing: border-box;");
    expect(styles).toContain(".remote-auth-logo");
    expect(styles).toContain("border-radius: 10px;");
    expect(styles).toContain("@media (max-width: 520px)");
  });

  it("provides browser voice typing that inserts the final transcript into the terminal", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("webkitSpeechRecognition");
    expect(source).toContain("SpeechRecognition");
    expect(source).toContain('aria-label={voiceInput.listening ? "Stop voice input" : "Start voice input"}');
    expect(source).toContain("recognition.onresult");
    expect(source).toContain("sendKey(transcript)");
    expect(source).toContain("recognition?.abort()");
  });

  it("accepts Android-safe setup paths and scrubs the one-time secret", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('url.pathname.match(/^\\/setup\\/([^/]+)');
    expect(source).toContain("decodeURIComponent");
    expect(source).toContain('url.searchParams.get("bootstrap")');
    expect(source).toContain('hashParams.get("bootstrap")');
    expect(source).toContain('url.searchParams.delete("bootstrap")');
    expect(source).toContain('url.pathname = "/"');
    expect(source).toContain("window.history.replaceState");
  });

  it("requires file or folder selection after authentication and before terminal creation", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("RemoteFolderPicker");
    expect(source).toContain("files: RemoteFile[]");
    expect(source).toContain('className="remote-folder-picker"');
    expect(source).toContain('className="remote-folder-picker-scroll"');
    expect(source).toContain("Open current folder");
    expect(source).not.toContain("Choose a file or folder");
    expect(source).not.toContain("mx-auto mb-5 grid size-20");
    expect(source).toContain("load(folder.path)");
    expect(source).toContain("onSelect(file.parent)");
    expect(source).toContain(
      'window.localStorage.removeItem("cmdspace.remote.cwd")',
    );
    expect(source).toContain("new AbortController()");
    expect(source).toContain("signal: request.signal");
    expect(source.indexOf("RemoteFolderPicker")).toBeLessThan(
      source.indexOf("RemoteSessionGrid"),
    );
  });

  it("filters locally and caches folder responses for low-latency navigation", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("remote-folder-search");
    expect(source).toContain("folderCacheRef");
    expect(source).toContain("folderCacheRef.current.get(path)");
    expect(source).toContain("filteredFolders");
    expect(source).toContain("filteredFiles");
  });

  it("retries a dropped terminal-create request without creating duplicate sessions", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("window.setInterval(() => client.createSession(remoteCwd), 1_500)");
    expect(source).not.toContain("createRequestedFor");
  });

  it("creates a dedicated terminal instead of attaching an unrelated desktop session", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("const availableSessions");
    expect(source).toContain("if (cwdSessions.length === 0)");
    expect(source).toContain(
      "const activeSession = cwdSessions.find((session) => session.id === activeSessionId) ?? null;",
    );
  });
});
