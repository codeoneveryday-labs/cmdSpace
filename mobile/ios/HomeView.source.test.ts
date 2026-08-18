import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootViewPath = path.join(
  process.cwd(),
  "mobile/ios/CmdSpaceMobileApp/RootView.swift",
);

describe("iOS Home quick connect", () => {
  it("uses the design's black add glyph on the neon quick-connect control", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain('Image(systemName: remote.isConnected ? "arrow.clockwise" : "plus")');
    expect(source).toContain(".foregroundStyle(.black)\n                    .frame(width: 30, height: 30)\n                    .background(CmdSpaceTheme.homeAcid)");
  });

  it("raises the quick-connect surface above the dark home canvas", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("static let homeQuickConnect = color(");
    expect(source).toContain(
      "dark: .init(red: 0.078, green: 0.082, blue: 0.098, alpha: 1)",
    );
    expect(source).toContain(
      "light: .init(red: 0.063, green: 0.067, blue: 0.078, alpha: 1)",
    );
  });

  it("limits Home-sheet drag dismissal to its handle so folder lists can scroll", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("private struct DismissibleBottomSheet<Content: View>: View");
    expect(source).toContain("DragGesture(minimumDistance: 8)");
    expect(source).toContain(".overlay(alignment: .top)");
    expect(source).toContain(".frame(height: 30)");
    expect(source).not.toContain(".highPriorityGesture(dismissGesture)");
    expect(source).toContain("value.predictedEndTranslation.height > 180");
    expect(source).toContain("DismissibleBottomSheet(onDismiss: { remote.pairingSheetOpen = false })");
  });

  it("connects scan result, all-workspaces, and workspace-creation screens", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("private struct ScanResultSheet: View");
    expect(source).toContain("Text(\"Desktop found\")");
    expect(source).toContain("private struct AllWorkspacesView: View");
    expect(source).toContain("Text(\"ALL WORKSPACES\")");
    expect(source).toContain("private struct CreateWorkspaceSheet: View");
    expect(source).toContain("Text(\"New workspace\")");
    expect(source).toContain("onScanResult: { payload in");
    expect(source).toContain("remote.pair(from: payload)");
    expect(source).toContain("remote.openWorkspace(workspace)");
    expect(source).toContain('Label("Desktop connection failed", systemImage: "wifi.exclamationmark")');
    expect(source).toContain('Button("Scan a new QR code", action: beginDesktopConnection)');
    expect(source).toContain("allWorkspacesOpen = true");
    expect(source).toContain("createWorkspaceOpen = true");
    expect(source).toContain('Text("Desktop found")');
    expect(source).toContain('remote.isConnected ? "Open workspace" : "Connect & open workspace"');
    expect(source).toContain('Button { selectedWorkspaceID = workspace.id }');
  });

  it("uses the original compact workspace list hierarchy and shared tab dock", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain(".padding(.top, 16)");
    expect(source).toContain("HomeTabBar(selectedTab: .home, homeAction: close, openSessions: {}, openFiles: openFiles, openSettings: openSettings)");
    expect(source).toContain('index == 0 ? "folder" : index == 1 ? "paintpalette" : "shippingbox"');
    expect(source).toContain('Text("Used recently")');
    expect(source).toContain('.accessibilityLabel("Back to Home")');
    expect(source).toContain('Image(systemName: "chevron.left")');
    expect(source).toContain('Image(systemName: "sun.max")');
    expect(source).toContain('.frame(width: 72, height: 44)');
    expect(source).toContain('.background(selected ? CmdSpaceTheme.homePrimaryAction : .clear)');
    expect(source).toContain('createWorkspace: { createWorkspaceOpen = true }');
    expect(source).toContain('.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)');
    expect(source).toContain('.frame(height: 700)');
    expect(source).toContain('.foregroundStyle(CmdSpaceTheme.homeInk)');
    expect(source).toContain('in: Circle())');
    expect(source).toContain('.accessibilityLabel("Close appearance")');
    expect(source).toContain('private struct TerminalPickerSheet: View');
    expect(source).toContain('Text("Select terminal")');
    expect(source).toContain('Text("Connected · SSH")');
    expect(source).toContain('.accessibilityLabel("Close scanned connection")');
    expect(source).toContain('private struct ScanResultSheet: View');
    expect(source).toContain('Label("Connect desktop to open", systemImage: "link")');
    expect(source).toContain('if remote.isConnected { allWorkspacesOpen = true } else { beginDesktopConnection() }');
    expect(source).toContain('private var terminalEmptyCanvas: some View');
    expect(source).toContain('Last login: connect a terminal from this workspace');
    expect(source).toContain('private var terminalActions: some View');
  });

  it("keeps Settings as a tab while Appearance stays a compact popup", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("private enum MobileTab");
    expect(source).toContain("case home, sessions, files, settings");
    expect(source).toContain("CmdSpaceSettingsView(");
    expect(source).toContain("private struct AppearancePopup: View");
    expect(source).toContain('Text("Appearance")');
    expect(source).toContain('Text("Choose the theme for cmdSpace.")');
    expect(source).toContain('Text("TERMINAL FONT")');
    expect(source).toContain('Text("TERMINAL BACKGROUND")');
    expect(source).not.toContain("settingsOpen");
  });

  it("surfaces non-blocking remote operation failures in an auto-dismissing toast", () => {
    const rootSource = readFileSync(rootViewPath, "utf8");
    const storeSource = readFileSync(
      path.join(process.cwd(), "mobile/ios/CmdSpaceMobileApp/RemoteStore.swift"),
      "utf8",
    );

    expect(rootSource).toContain("private struct ErrorToast: View");
    expect(rootSource).toContain("remote.transientError");
    expect(rootSource).toContain("Task.sleep(for: .seconds(4))");
    expect(rootSource).toContain("UIAccessibility.post(notification: .announcement");
    expect(storeSource).toContain("@Published private(set) var transientError: String?");
    expect(storeSource).toContain("private func reportTransientFailure(_ message: String)");
  });

  it("opens a Files tab scoped to the selected workspace", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("else if selectedTab == .files");
    expect(source).toContain("private struct FilesWorkspaceView: View");
    expect(source).toContain('Text("DIRECTORY")');
    expect(source).toContain("remote.selectedWorkspace ?? remote.recentWorkspaces.first");
    expect(source).toContain("HomeTabBar(selectedTab: .files");
  });

  it("creates owned workspace terminals instead of showing a placeholder", () => {
    const rootSource = readFileSync(rootViewPath, "utf8");
    const storeSource = readFileSync(
      path.join(process.cwd(), "mobile/ios/CmdSpaceMobileApp/RemoteStore.swift"),
      "utf8",
    );

    expect(rootSource).toContain("remote.createWorkspace(");
    expect(rootSource).not.toContain("Workspace creation is not available yet");
    expect(storeSource).toContain("func createWorkspace(");
    expect(storeSource).toContain(".createWorkspace(");
    expect(storeSource).toContain("$0.workspaceId == workspace.id");
    expect(storeSource).not.toContain("$0.cwd == workspace.workingFolder");
  });

  it("offers workspace creation directly from the connected empty Home state", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain('Label("Create mobile workspace", systemImage: "plus")');
    expect(source).toMatch(/if remote\.isConnected\s*\{\s*Button\s*\{\s*createWorkspaceOpen = true/);
  });

  it("uses the desktop folder picker instead of asking users to type a path", () => {
    const rootSource = readFileSync(rootViewPath, "utf8");
    const storeSource = readFileSync(
      path.join(process.cwd(), "mobile/ios/CmdSpaceMobileApp/RemoteStore.swift"),
      "utf8",
    );

    expect(rootSource).toContain("private struct FolderPickerSheet: View");
    expect(rootSource).toContain('Text("Choose a folder")');
    expect(rootSource).toContain("remote.browseFolderPicker()");
    expect(rootSource).toContain("workingDirectory = path");
    expect(rootSource).not.toContain('placeholder: "~/dev/app/snake-game"');
    expect(storeSource).toContain("func browseFolderPicker(path: String? = nil)");
    expect(storeSource).toContain(".listFolderPickerDirectory(path: path)");
  });

  it("filters the visible folder picker entries locally by name", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain('@State private var searchText = ""');
    expect(source).toContain('TextField("Search folders", text: $searchText)');
    expect(source).toContain("$0.name.localizedCaseInsensitiveContains(searchText)");
    expect(source).toContain('Text("No matching folders")');
  });

  it("gives connecting state a branded progress surface instead of raw terminal text", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain('Text("Connecting your desktop")');
    expect(source).toContain('Text("Securing a connection to your cmdSpace desktop.")');
    expect(source).toContain('Image(systemName: "desktopcomputer")');
    expect(source).toContain('Label("Cancel", systemImage: "xmark")');
  });

  it("ignores callbacks from a cancelled desktop socket after a reconnect", () => {
    const storeSource = readFileSync(
      path.join(process.cwd(), "mobile/ios/CmdSpaceMobileApp/RemoteStore.swift"),
      "utf8",
    );

    expect(storeSource).toContain("private func receive(from task: URLSessionWebSocketTask, generation: Int)");
    expect(storeSource).toContain("self.connectionGeneration == generation, self.webSocket === task");
  });

  it("does not reattach the active terminal for every session-list refresh", () => {
    const storeSource = readFileSync(
      path.join(process.cwd(), "mobile/ios/CmdSpaceMobileApp/RemoteStore.swift"),
      "utf8",
    );

    expect(storeSource).toContain("private var needsActiveSessionReattachment = false");
    expect(storeSource).toContain("if needsActiveSessionReattachment");
    expect(storeSource).not.toContain("if let activeSessionId {\n                if let session = next.first(where: { $0.id == activeSessionId }) {\n                    attach(session)");
  });

  it("submits terminal commands from both the system Return key and send control", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("private struct TerminalCommandField: UIViewRepresentable");
    expect(source).toContain("func textFieldShouldReturn(_ textField: UITextField) -> Bool");
    expect(source).toContain("TerminalCommandPayload.make(from: value)");
    expect(source).toContain("TerminalCommandField(text: $command, placeholder: inputPlaceholder, submit: sendCommand)");
  });

  it("submits the current UIKit field value instead of waiting for a SwiftUI state refresh", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("let submit: (String) -> Void");
    expect(source).toContain("private func submitReturn(from textField: UITextField)");
    expect(source).toContain("let value = textField.text ?? \"\"");
    expect(source).toContain("private func sendCommand(_ submittedCommand: String? = nil)");
  });

  it("explains when a terminal is owned by Codex instead of a shell", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("Codex CLI is active");
    expect(source).toContain("Messages go to Codex, not the shell.");
    expect(source).toContain('("⌃C", "\\u{0003}")');
    expect(source).toContain("placeholder: inputPlaceholder");
  });

  it("keeps terminal chrome readable in both light and dark appearances", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("static let terminalInk = color(");
    expect(source).toContain("static let terminalChrome = color(");
    expect(source).toContain("static let terminalLine = color(");
    expect(source).toContain('.foregroundStyle(CmdSpaceTheme.terminalInk)');
    expect(source).toContain('.background(CmdSpaceTheme.terminalChrome, in: Circle())');
    expect(source).toContain(".foregroundStyle(CmdSpaceTheme.terminalInk)\n                        .frame(maxWidth: .infinity, alignment: .leading)");
  });

  it("offers an 8 px terminal font size and applies the chosen size to output", () => {
    const source = readFileSync(rootViewPath, "utf8");

    expect(source).toContain("ForEach([8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0]");
    expect(source).toContain(".font(.system(size: terminalFontSize, weight: .regular, design: .monospaced))");
  });
});
