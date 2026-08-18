import SwiftUI
import UIKit
import VisionKit
import CmdSpaceMobileCore

private enum MobileTab {
    case home, sessions, files, settings
}

struct RootView: View {
    @EnvironmentObject private var remote: RemoteStore
    @State private var selectedTab: MobileTab = .home
    @State private var appearancePopupOpen = false
    @State private var workspaceTerminalOpen = false
    @State private var importSessionsOpen = false
    @State private var toast: ErrorToastContent?
    @State private var toastDismissTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .top) {
            CmdSpaceTheme.canvas.ignoresSafeArea()

            Group {
                if selectedTab == .settings {
                    CmdSpaceSettingsView(selectHome: { selectedTab = .home })
                } else if selectedTab == .files {
                    FilesWorkspaceView(selectHome: { selectedTab = .home })
                } else if selectedTab == .sessions {
                    SessionsWorkspaceView(selectHome: { selectedTab = .home }, openTerminal: { selectedTab = .home })
                } else {
                    switch remote.state {
                    case .unpaired, .failed:
                        HomeView(
                            openAppearance: { appearancePopupOpen = true },
                            openSettings: { selectedTab = .settings },
                            openFiles: { selectedTab = .files },
                            openSessions: { selectedTab = .sessions }
                        )
                    case .connecting: ConnectingView()
                    case .connected:
                        if remote.selectedWorkspace == nil {
                            HomeView(
                                openAppearance: { appearancePopupOpen = true },
                                openSettings: { selectedTab = .settings },
                                openFiles: { selectedTab = .files },
                                openSessions: { selectedTab = .sessions }
                            )
                        } else if importSessionsOpen {
                            ImportSessionsView(
                                close: { importSessionsOpen = false },
                                openTerminal: {
                                    importSessionsOpen = false
                                    workspaceTerminalOpen = true
                                }
                            )
                        } else if workspaceTerminalOpen {
                            TerminalRemoteView()
                        } else {
                            WorkspaceDetailView(
                                openTerminal: { workspaceTerminalOpen = true },
                                openImport: { importSessionsOpen = true }
                            )
                        }
                    }
                }
            }

            if appearancePopupOpen {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture { appearancePopupOpen = false }
                AppearancePopup(close: { appearancePopupOpen = false })
                    .padding(.horizontal, 20)
                    .padding(.top, 44)
                    .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .top)))
            }
        }
        .overlay(alignment: .bottom) {
            if let toast {
                ErrorToast(message: toast.message)
                    .padding(.horizontal, 32)
                    .padding(.bottom, 96)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.20), value: appearancePopupOpen)
        .animation(.easeOut(duration: 0.20), value: toast)
        .onChange(of: remote.selectedWorkspace?.id) { _, _ in
            workspaceTerminalOpen = false
            importSessionsOpen = false
        }
        .onChange(of: remote.transientError) { _, message in
            guard let message else { return }
            presentToast(message)
            remote.dismissTransientError()
        }
        .onDisappear { toastDismissTask?.cancel() }
    }

    private func presentToast(_ message: String) {
        toastDismissTask?.cancel()
        let nextToast = ErrorToastContent(message: message)
        toast = nextToast
        toastDismissTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled, toast == nextToast else { return }
            toast = nil
        }
    }
}

private struct ErrorToastContent: Equatable {
    let message: String
}

private struct ErrorToast: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(CmdSpaceTheme.homeError)
            Text(message)
                .lineLimit(1)
        }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(.horizontal, 16)
            .background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
            .accessibilityElement(children: .combine)
            .onAppear {
                UIAccessibility.post(notification: .announcement, argument: message)
            }
    }
}

private struct DismissibleBottomSheet<Content: View>: View {
    @GestureState private var dragOffset: CGFloat = 0
    let onDismiss: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .offset(y: dragOffset)
            .overlay(alignment: .top) {
                Color.clear
                    .contentShape(Rectangle())
                    .frame(height: 30)
                    .gesture(dismissGesture)
            }
            .animation(.spring(response: 0.28, dampingFraction: 0.82), value: dragOffset)
    }

    private var dismissGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .updating($dragOffset) { value, state, _ in
                state = max(0, value.translation.height)
            }
            .onEnded { value in
                guard value.translation.height > 110
                    || value.predictedEndTranslation.height > 180
                else { return }
                onDismiss()
            }
    }
}

private struct HomeView: View {
    @EnvironmentObject private var remote: RemoteStore
    let openAppearance: () -> Void
    let openSettings: () -> Void
    let openFiles: () -> Void
    let openSessions: () -> Void
    @State private var allWorkspacesOpen = false
    @State private var scanResultPayload: String?
    @State private var createWorkspaceOpen = false

    var body: some View {
        ZStack(alignment: .bottom) {
            if allWorkspacesOpen {
                AllWorkspacesView(
                    close: { allWorkspacesOpen = false },
                    openSettings: openSettings,
                    openFiles: openFiles,
                    createWorkspace: { createWorkspaceOpen = true }
                )
            } else {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 26) {
                            header
                            welcome
                            quickConnect
                            connectionFailure
                            recentWorkspaces
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 24)
                    }
                    .scrollIndicators(.hidden)

                    HomeTabBar(selectedTab: .home, homeAction: {}, openSessions: openSessions, openFiles: openFiles, openSettings: openSettings)
                }
                .foregroundStyle(CmdSpaceTheme.homeInk)
                .background(CmdSpaceTheme.homePaper)
            }

            if remote.pairingSheetOpen {
                CmdSpaceTheme.homeInk.opacity(0.40)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { remote.pairingSheetOpen = false }

                DismissibleBottomSheet(onDismiss: { remote.pairingSheetOpen = false }) {
                    PairingLinkView(onScanResult: { payload in
                        remote.pairingSheetOpen = false
                        // A valid QR starts authentication immediately. Closing the
                        // chooser must not silently discard the desktop connection.
                        remote.pair(from: payload)
                        scanResultPayload = payload
                    })
                        .frame(maxWidth: .infinity)
                        .frame(height: 540)
                        .background(CmdSpaceTheme.homePaper)
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26))
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .accessibilityAddTraits(.isModal)
                }
            }

            if let scanResultPayload {
                CmdSpaceTheme.homeInk.opacity(0.40)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { self.scanResultPayload = nil }

                DismissibleBottomSheet(onDismiss: { self.scanResultPayload = nil }) {
                    ScanResultSheet(
                        pairingPayload: scanResultPayload,
                        close: { self.scanResultPayload = nil },
                        chooseWorkspace: { workspace in
                            self.scanResultPayload = nil
                            remote.openWorkspace(workspace)
                        },
                        createWorkspace: {
                            self.scanResultPayload = nil
                            createWorkspaceOpen = true
                        }
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 578)
                    .background(CmdSpaceTheme.homePaper)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityAddTraits(.isModal)
                }
            }

            if createWorkspaceOpen {
                CmdSpaceTheme.homeInk.opacity(0.40)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { createWorkspaceOpen = false }

                DismissibleBottomSheet(onDismiss: { createWorkspaceOpen = false }) {
                    CreateWorkspaceSheet(
                        close: { createWorkspaceOpen = false },
                        isCreationAvailable: remote.isConnected,
                        createWorkspace: { name, workingFolder, terminalCount in
                            createWorkspaceOpen = false
                            remote.createWorkspace(
                                name: name,
                                workingFolder: workingFolder,
                                terminalCount: terminalCount
                            )
                        }
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 700)
                    .background(CmdSpaceTheme.homePaper)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityAddTraits(.isModal)
                }
            }
        }
        .animation(.easeOut(duration: 0.22), value: remote.pairingSheetOpen)
        .animation(.easeOut(duration: 0.22), value: scanResultPayload != nil)
        .animation(.easeOut(duration: 0.22), value: createWorkspaceOpen)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func beginDesktopConnection() {
        remote.pairingSheetOpen = true
    }

    private func connect() {
        if remote.isConnected {
            remote.refreshWorkspaces()
            return
        }
        beginDesktopConnection()
    }

    private var header: some View {
        HStack(spacing: 10) {
            CmdSpaceLogo(size: 38)
            Text("cmdSpace")
                .font(.system(size: 20, weight: .bold))
            Spacer()
            Button(action: openAppearance) {
                Image(systemName: "sun.max")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(CmdSpaceTheme.homeInk)
                    .frame(width: 40, height: 40)
                    .background(CmdSpaceTheme.homeNav)
                    .clipShape(Circle())
            }
            .accessibilityLabel("Appearance")
        }
        .frame(height: 50)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Good evening.")
                .font(.system(size: 30, weight: .bold))
                .tracking(-1.2)
            Text("Pick up where you left off.")
                .font(.system(size: 15))
                .foregroundStyle(CmdSpaceTheme.homeMuted)
        }
    }

    private var quickConnect: some View {
        Button(action: connect) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(remote.isConnected ? "Desktop connected" : "Quick connect")
                        .font(.system(size: 15, weight: .bold))
                    Text(remote.isConnected ? "Refresh the latest workspaces" : "Scan a QR code or paste a pairing link")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.66))
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: remote.isConnected ? "arrow.clockwise" : "plus")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(width: 30, height: 30)
                    .background(CmdSpaceTheme.homeAcid)
                    .clipShape(Circle())
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 64)
            .foregroundStyle(.white)
            .background(CmdSpaceTheme.homeQuickConnect)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(CmdSpaceCardButtonStyle())
        .accessibilityLabel(remote.isConnected ? "Refresh workspaces" : "Quick connect a desktop")
    }

    private var recentWorkspaces: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text("Mobile workspaces")
                    .font(.system(size: 17, weight: .bold))
                Spacer()
                if !remote.recentWorkspaces.isEmpty {
                    Button("See all") {
                        if remote.isConnected { allWorkspacesOpen = true } else { beginDesktopConnection() }
                    }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(remote.isConnected ? CmdSpaceTheme.homeMuted : CmdSpaceTheme.homeAcid)
                        .accessibilityHint(remote.isConnected ? "Open all workspaces" : "Connect a desktop first")
                }
            }

            if remote.recentWorkspaces.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    Text(remote.isConnected ? "No mobile workspaces yet. Create one from a folder on this desktop." : "Connect your cmdSpace desktop to access your mobile workspaces.")
                        .font(.system(size: 14))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)

                    if remote.isConnected {
                        Button {
                            createWorkspaceOpen = true
                        } label: {
                            Label("Create mobile workspace", systemImage: "plus")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(
                                    CmdSpaceTheme.homePrimaryAction,
                                    in: RoundedRectangle(cornerRadius: 15, style: .continuous)
                                )
                        }
                        .buttonStyle(CmdSpaceCardButtonStyle())
                        .accessibilityHint("Choose a desktop folder and create a mobile workspace")
                    }
                }
                .padding(.vertical, 18)
            } else {
                ForEach(Array(remote.recentWorkspaces.prefix(3).enumerated()), id: \.element.id) { index, workspace in
                    Button {
                        if remote.isConnected { remote.openWorkspace(workspace) } else { beginDesktopConnection() }
                    } label: {
                        WorkspaceHomeRow(workspace: workspace, index: index, requiresConnection: !remote.isConnected)
                    }
                    .buttonStyle(CmdSpaceCardButtonStyle())
                    .accessibilityHint(remote.isConnected ? "Open workspace" : "Connect a desktop first")
                }
            }
        }
    }

    @ViewBuilder private var connectionFailure: some View {
        if case let .failed(message) = remote.state {
            VStack(alignment: .leading, spacing: 8) {
                Label("Desktop connection failed", systemImage: "wifi.exclamationmark")
                    .font(.system(size: 13, weight: .bold))
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                Button("Scan a new QR code", action: beginDesktopConnection)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeAcid)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 15))
            .accessibilityElement(children: .combine)
        }
    }
}

private struct WorkspaceHomeRow: View {
    let workspace: RemoteWorkspace
    let index: Int
    let requiresConnection: Bool

    var body: some View {
        HStack(spacing: 13) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(CmdSpaceTheme.workspaceMark(index: index))
                Text(index == 0 ? ">" : index == 1 ? "▦" : "◫")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeInk)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 4) {
                Text(workspace.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeInk)
                    .lineLimit(1)
                Text(workspace.workingFolder)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: requiresConnection ? "lock.fill" : "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(requiresConnection ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeMuted)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 82)
        .background(CmdSpaceTheme.homeCard)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(CmdSpaceTheme.homeLine))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(alignment: .bottomLeading) {
            if requiresConnection { Label("Connect desktop to open", systemImage: "link").font(.system(size: 10, weight: .semibold)).foregroundStyle(CmdSpaceTheme.homeMuted).padding(.leading, 70).padding(.bottom, 8) }
        }
    }
}

private struct ScanResultSheet: View {
    @EnvironmentObject private var remote: RemoteStore
    let pairingPayload: String
    let close: () -> Void
    let chooseWorkspace: (RemoteWorkspace) -> Void
    let createWorkspace: () -> Void
    @State private var selectedWorkspaceID: String?

    private var endpointDescription: String {
        guard let payload = try? PairingPayload.parse(pairingPayload) else {
            return "Secure cmdSpace connection"
        }
        return payload.webSocketURL.host.map { "wss://\($0)" } ?? "Secure cmdSpace connection"
    }

    var body: some View {
        ZStack(alignment: .top) {
            SheetHandle()
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Desktop found")
                        .font(.system(size: 21, weight: .bold))
                    Spacer()
                    Button(action: close) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(CmdSpaceTheme.homeInk)
                            .frame(width: 34, height: 34)
                            .background(CmdSpaceTheme.homeNav, in: Circle())
                    }
                    .accessibilityLabel("Close scanned connection")
                }

                HStack(spacing: 10) {
                    Image(systemName: "server.rack")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                        .frame(width: 36, height: 36)
                        .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("cmdSpace desktop")
                            .font(.system(size: 14, weight: .bold))
                        Text(endpointDescription)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                            .lineLimit(1)
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(CmdSpaceTheme.homeCard)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(CmdSpaceTheme.homeLine))

                Text("CHOOSE A WORKSPACE TO CONNECT")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)

                if remote.recentWorkspaces.isEmpty {
                    Text("No cached workspaces yet. Connect to continue.")
                        .font(.system(size: 13))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
                } else {
                    ForEach(Array(remote.recentWorkspaces.prefix(2).enumerated()), id: \.element.id) { index, workspace in
                        let isSelected = selectedWorkspaceID == workspace.id
                        Button { selectedWorkspaceID = workspace.id } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "folder")
                                    .font(.system(size: 18, weight: .medium))
                                    .frame(width: 34, height: 34)
                                    .background(CmdSpaceTheme.workspaceMark(index: index), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(workspace.name).font(.system(size: 14, weight: .bold))
                                    Text(workspace.workingFolder)
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(isSelected ? CmdSpaceTheme.accent : CmdSpaceTheme.homeMuted)
                            }
                            .padding(.horizontal, 13)
                            .frame(maxWidth: .infinity, minHeight: 58)
                            .background(isSelected ? CmdSpaceTheme.homeSelection : CmdSpaceTheme.homeCard)
                            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                        }
                        .buttonStyle(CmdSpaceCardButtonStyle())
                        .accessibilityLabel("Select \(workspace.name) to connect")
                    }
                }

                Button {
                    guard let selectedWorkspace = remote.recentWorkspaces.first(where: { $0.id == selectedWorkspaceID }) else { return }
                    chooseWorkspace(selectedWorkspace)
                } label: {
                    Label(remote.isConnected ? "Open workspace" : "Connect & open workspace", systemImage: remote.isConnected ? "arrow.right" : "link")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(selectedWorkspaceID == nil ? CmdSpaceTheme.homeMuted : CmdSpaceTheme.homePrimaryAction)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(CmdSpaceCardButtonStyle())
                .disabled(selectedWorkspaceID == nil)
            }
            .padding(.top, 38)
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear {
            if selectedWorkspaceID == nil { selectedWorkspaceID = remote.recentWorkspaces.first?.id }
        }
    }
}

private struct AllWorkspacesView: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    let openSettings: () -> Void
    let openFiles: () -> Void
    let createWorkspace: () -> Void
    @State private var searchText = ""

    private var filteredWorkspaces: [RemoteWorkspace] {
        guard !searchText.isEmpty else { return remote.recentWorkspaces }
        return remote.recentWorkspaces.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.workingFolder.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Button(action: close) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundStyle(CmdSpaceTheme.homeInk)
                                    .frame(width: 34, height: 34)
                                    .background(CmdSpaceTheme.homeNav, in: Circle())
                            }
                            .accessibilityLabel("Back to Home")
                            Spacer()
                            Button(action: createWorkspace) {
                                Image(systemName: "plus")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(CmdSpaceTheme.homeAcid)
                                    .frame(width: 34, height: 34)
                                    .background(CmdSpaceTheme.homePrimaryAction, in: Circle())
                            }
                            .accessibilityLabel("Create workspace")
                        }
                        HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Workspaces")
                                .font(.system(size: 30, weight: .bold))
                            Text("\(remote.recentWorkspaces.count) mobile workspaces")
                                .font(.system(size: 13))
                                .foregroundStyle(CmdSpaceTheme.homeMuted)
                        }
                        Spacer()
                        }
                    }

                    HStack(spacing: 9) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                        TextField("Search workspaces", text: $searchText)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .font(.system(size: 13))
                            .accessibilityLabel("Search workspaces")
                    }
                    .padding(.horizontal, 13)
                    .frame(height: 46)
                    .background(CmdSpaceTheme.homeCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CmdSpaceTheme.homeLine))

                    Text("ALL WORKSPACES")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)

                    if filteredWorkspaces.isEmpty {
                        ContentUnavailableView("No workspaces found", systemImage: "folder")
                            .frame(maxWidth: .infinity, minHeight: 260)
                    } else {
                        ForEach(Array(filteredWorkspaces.enumerated()), id: \.element.id) { index, workspace in
                            Button { remote.openWorkspace(workspace) } label: {
                                AllWorkspaceRow(
                                    workspace: workspace,
                                    index: index,
                                    sessionCount: remote.sessions.filter { $0.workspaceId == workspace.id }.count
                                )
                            }
                            .buttonStyle(CmdSpaceCardButtonStyle())
                            .disabled(!remote.isConnected)
                            .accessibilityHint(remote.isConnected ? "Open workspace" : "Connect a desktop first")
                        }
                    }

                    Label("Each workspace groups terminals and files for one project directory.", systemImage: "info.circle")
                        .font(.system(size: 12))
                        .foregroundStyle(CmdSpaceTheme.workspaceTip)
                        .padding(13)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(CmdSpaceTheme.workspaceTipSurface, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)

            HomeTabBar(selectedTab: .home, homeAction: close, openSessions: {}, openFiles: openFiles, openSettings: openSettings)
        }
        .foregroundStyle(CmdSpaceTheme.homeInk)
        .background(CmdSpaceTheme.homePaper)
    }
}

private struct AllWorkspaceRow: View {
    let workspace: RemoteWorkspace
    let index: Int
    let sessionCount: Int

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: index == 0 ? "folder" : index == 1 ? "paintpalette" : "shippingbox")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(CmdSpaceTheme.homeInk)
                .frame(width: 46, height: 46)
                .background(CmdSpaceTheme.workspaceMark(index: index), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Text(workspace.name).font(.system(size: 15, weight: .bold))
                    Text("\(sessionCount) \(sessionCount == 1 ? "session" : "sessions")")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                }
                Text(workspace.workingFolder)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                    .lineLimit(1)
                Text("Used recently")
                    .font(.system(size: 10))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(CmdSpaceTheme.homeMuted)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 92)
        .background(CmdSpaceTheme.homeCard)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(CmdSpaceTheme.homeLine))
    }
}

private struct CreateWorkspaceSheet: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    let isCreationAvailable: Bool
    let createWorkspace: (String, String, Int) -> Void
    @State private var workspaceName = ""
    @State private var workingDirectory = ""
    @State private var selectedIcon = "folder"
    @State private var terminalCount = 1
    @State private var folderPickerOpen = false
    @FocusState private var focusedField: Field?

    private enum Field { case name }
    private let icons = ["folder", "shippingbox", "terminal", "chevron.left.forwardslash.chevron.right", "rocket"]

    var body: some View {
        ZStack(alignment: .top) {
            SheetHandle()
            if folderPickerOpen {
                FolderPickerSheet(
                    close: { folderPickerOpen = false },
                    select: { path in
                        workingDirectory = path
                        if workspaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            workspaceName = URL(fileURLWithPath: path).lastPathComponent
                        }
                        folderPickerOpen = false
                    }
                )
            } else {
                workspaceForm
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var workspaceForm: some View {
        VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("New workspace")
                        .font(.system(size: 22, weight: .bold))
                    Spacer()
                    Button(action: close) {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(CmdSpaceTheme.homeInk)
                            .frame(width: 34, height: 34)
                            .background(CmdSpaceTheme.homeNav, in: Circle())
                    }
                    .accessibilityLabel("Close create workspace")
                }

                formLabel("WORKSPACE NAME")
                formField(icon: "folder", placeholder: "snake-game", text: $workspaceName, field: .name)
                formLabel("WORKING DIRECTORY")
                Button {
                    remote.browseFolderPicker()
                    folderPickerOpen = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "folder.badge.gearshape")
                            .font(.system(size: 17, weight: .medium))
                        Text(workingDirectory.isEmpty ? "Choose a folder" : workingDirectory)
                            .font(.system(size: 13, design: .monospaced))
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(workingDirectory.isEmpty ? CmdSpaceTheme.homeMuted : CmdSpaceTheme.homeInk)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CmdSpaceTheme.homeLine))
                }
                .buttonStyle(CmdSpaceCardButtonStyle())
                .accessibilityHint("Browse folders on the connected desktop")
                formLabel("ICON")
                HStack(spacing: 10) {
                    ForEach(icons, id: \.self) { icon in
                        Button { selectedIcon = icon } label: {
                            Image(systemName: icon)
                                .font(.system(size: 19, weight: .semibold))
                                .foregroundStyle(CmdSpaceTheme.homeInk)
                                .frame(width: 48, height: 48)
                                .background(selectedIcon == icon ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CmdSpaceTheme.homeLine))
                        }
                        .accessibilityLabel("Workspace icon \(icon)")
                    }
                }

                formLabel("STARTING TERMINALS")
                HStack(spacing: 8) {
                    stepperButton(symbol: "minus", enabled: terminalCount > 1) { terminalCount -= 1 }
                    Spacer()
                    HStack(spacing: 7) {
                        Text("\(terminalCount) \(terminalCount == 1 ? "terminal" : "terminals")")
                            .font(.system(size: 15, weight: .bold))
                        Text("of 12")
                            .font(.system(size: 12))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                    }
                    Spacer()
                    stepperButton(symbol: "plus", enabled: terminalCount < 12) { terminalCount += 1 }
                }
                .padding(6)
                .frame(height: 54)
                .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                Button {
                    createWorkspace(workspaceName, workingDirectory, terminalCount)
                } label: {
                    Text("Create workspace")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
                .buttonStyle(CmdSpaceCardButtonStyle())
                .disabled(!isCreationAvailable || workspaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || workingDirectory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if !isCreationAvailable {
                    Text("Connect a desktop before creating a workspace.")
                        .font(.system(size: 12))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
        }
        .padding(.top, 38)
        .padding(.horizontal, 20)
        .padding(.bottom, 26)
    }

    private func formLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(CmdSpaceTheme.homeMuted)
    }

    private func formField(icon: String, placeholder: String, text: Binding<String>, field: Field) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(CmdSpaceTheme.homeMuted)
            TextField(placeholder, text: text)
                .focused($focusedField, equals: field)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(size: 13, design: .monospaced))
        }
        .padding(.horizontal, 14)
        .frame(height: 50)
        .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CmdSpaceTheme.homeLine))
    }

    private func stepperButton(symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(symbol == "plus" ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeMuted)
                .frame(width: 42, height: 42)
                .background(symbol == "plus" ? CmdSpaceTheme.homePrimaryAction : CmdSpaceTheme.homeCard, in: Circle())
        }
        .disabled(!enabled)
        .accessibilityLabel(symbol == "plus" ? "Increase terminal count" : "Decrease terminal count")
    }
}

private struct FolderPickerSheet: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    let select: (String) -> Void
    @State private var searchText = ""

    private var visibleEntries: [RemoteDirectoryEntry] {
        let searchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !searchText.isEmpty else { return remote.folderPickerEntries }
        return remote.folderPickerEntries.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Button(action: close) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                        .frame(width: 42, height: 42)
                        .background(CmdSpaceTheme.homeNav, in: Circle())
                }
                .accessibilityLabel("Back to workspace setup")

                VStack(alignment: .leading, spacing: 2) {
                    Text("Choose a folder")
                        .font(.system(size: 22, weight: .bold))
                    Text("Browse folders on your connected desktop")
                        .font(.system(size: 12))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                }
                Spacer()
            }

            HStack(spacing: 10) {
                Image(systemName: "folder")
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                Text(remote.folderPickerPath.isEmpty ? "Loading folders…" : remote.folderPickerPath)
                    .font(.system(size: 12, design: .monospaced))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                TextField("Search folders", text: $searchText)
                    .font(.system(size: 15))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                    }
                    .accessibilityLabel("Clear folder search")
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 46)
            .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CmdSpaceTheme.homeLine))

            if let parent = remote.folderPickerParent {
                Button {
                    searchText = ""
                    remote.browseFolderPicker(path: parent)
                } label: {
                    Label("Up one folder", systemImage: "arrow.up")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(CmdSpaceCardButtonStyle())
            }

            Group {
                if remote.folderPickerLoading {
                    ProgressView("Loading folders…")
                        .frame(maxWidth: .infinity, minHeight: 180)
                } else if let error = remote.folderPickerError {
                    VStack(spacing: 12) {
                        Text(error).font(.system(size: 13)).foregroundStyle(CmdSpaceTheme.homeMuted)
                        Button("Try again") { remote.browseFolderPicker(path: remote.folderPickerPath.isEmpty ? nil : remote.folderPickerPath) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 180)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(visibleEntries) { entry in
                                Button {
                                    searchText = ""
                                    remote.browseFolderPicker(path: entry.path)
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "folder.fill")
                                            .font(.system(size: 17))
                                            .foregroundStyle(CmdSpaceTheme.homeAcid)
                                            .frame(width: 28)
                                        Text(entry.name)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundStyle(CmdSpaceTheme.homeInk)
                                            .lineLimit(1)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                                    }
                                    .padding(.horizontal, 14)
                                    .frame(maxWidth: .infinity, minHeight: 52)
                                    .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CmdSpaceTheme.homeLine))
                                }
                                .buttonStyle(CmdSpaceCardButtonStyle())
                            }
                            if visibleEntries.isEmpty {
                                Text("No matching folders")
                                    .font(.system(size: 14))
                                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                                    .frame(maxWidth: .infinity, minHeight: 120)
                            }
                        }
                    }
                }
            }

            Button {
                guard !remote.folderPickerPath.isEmpty else { return }
                select(remote.folderPickerPath)
            } label: {
                Text("Choose this folder")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            .buttonStyle(CmdSpaceCardButtonStyle())
            .disabled(remote.folderPickerPath.isEmpty || remote.folderPickerLoading)
        }
        .padding(.top, 38)
        .padding(.horizontal, 20)
        .padding(.bottom, 26)
    }
}

private struct SheetHandle: View {
    var body: some View {
        Capsule()
            .fill(CmdSpaceTheme.homeLine)
            .frame(width: 38, height: 4)
            .padding(.top, 10)
    }
}

private struct HomeTabBar: View {
    let selectedTab: MobileTab
    let homeAction: () -> Void
    let openSessions: () -> Void
    let openFiles: () -> Void
    let openSettings: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            tab(symbol: "house", label: "Home", selected: selectedTab == .home, action: homeAction)
            tab(symbol: "desktopcomputer", label: "Sessions", selected: selectedTab == .sessions, action: openSessions)
            tab(symbol: "folder", label: "Files", selected: selectedTab == .files, action: openFiles)
            tab(symbol: "slider.horizontal.3", label: "Settings", selected: selectedTab == .settings, action: openSettings)
        }
        .padding(6)
        .frame(height: 56)
        .background(CmdSpaceTheme.homeNav)
        .clipShape(Capsule())
        .shadow(color: CmdSpaceTheme.homeInk.opacity(0.09), radius: 14, y: 4)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 16)
        .background(CmdSpaceTheme.homePaper)
    }

    private func tab(symbol: String, label: String, selected: Bool, action: @escaping () -> Void = {}) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(selected ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeMuted)
                .frame(width: 72, height: 44)
                .background(selected ? CmdSpaceTheme.homePrimaryAction : .clear)
            .clipShape(Capsule())
        }
        .accessibilityLabel(label)
        .accessibilityHint(selected ? "Current tab" : "Available in the next mobile phase")
    }
}

private struct PairingLinkView: View {
    @EnvironmentObject private var remote: RemoteStore
    let onScanResult: (String) -> Void
    @State private var pairingText = ""
    @State private var scannerOpen = false
    @State private var showCameraUnavailable = false
    @FocusState private var pairingFieldFocused: Bool

    var body: some View {
        ZStack(alignment: .top) {
            Capsule()
                .fill(CmdSpaceTheme.homeLine)
                .frame(width: 38, height: 4)
                .padding(.top, 10)

            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Quick connect")
                        .font(.system(size: 21, weight: .bold))
                    Spacer()
                    Button { remote.pairingSheetOpen = false } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(CmdSpaceTheme.homeInk)
                            .frame(width: 34, height: 34)
                            .background(CmdSpaceTheme.homeNav)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Close quick connect")
                }

                Text("Add a workspace with a secure connection link.")
                    .font(.system(size: 14))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)

                Button(action: scanQRCode) {
                    HStack(spacing: 13) {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.system(size: 20, weight: .medium))
                            .frame(width: 48, height: 48)
                            .background(CmdSpaceTheme.homeAcid)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Scan QR code")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Open camera to connect instantly")
                                .font(.system(size: 12))
                                .foregroundStyle(.white.opacity(0.66))
                        }
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, minHeight: 86)
                    .foregroundStyle(.white)
                    .background(CmdSpaceTheme.homeQuickConnect)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(CmdSpaceCardButtonStyle())

                Text("OR ENTER A CONNECTION URL")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeMuted)
                    .frame(maxWidth: .infinity)

                HStack(spacing: 8) {
                    Image(systemName: "link")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                    TextField("cmdspace://device-pair…", text: $pairingText)
                        .focused($pairingFieldFocused)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(size: 14, design: .monospaced))
                        .lineLimit(1)
                        .accessibilityLabel("cmdSpace pairing link")
                }
                .padding(.horizontal, 15)
                .frame(height: 52)
                .background(CmdSpaceTheme.homeCard)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CmdSpaceTheme.homeLine))

                if case let .failed(message) = remote.state {
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(.red)
                        .padding(.top, 7)
                        .lineLimit(2)
                }

                Button(action: connect) {
                    Text("Connect")
                        .font(.system(size: 14, weight: .bold))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .foregroundStyle(pairingText.isEmpty ? CmdSpaceTheme.homeMuted : CmdSpaceTheme.homePaper)
                        .background(pairingText.isEmpty ? CmdSpaceTheme.homeNav : CmdSpaceTheme.homeInk)
                        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
                .disabled(pairingText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Button { pairingFieldFocused = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "questionmark.circle")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                        Text("How to create a QR?")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 36)
                }
            }
            .padding(.top, 38)
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(CmdSpaceTheme.homePaper)
        .fullScreenCover(isPresented: $scannerOpen) {
            ScannerScreen(
                onScan: { payload in
                    scannerOpen = false
                    onScanResult(payload)
                },
                onClose: { scannerOpen = false },
                onUnavailable: {
                    scannerOpen = false
                    showCameraUnavailable = true
                }
            )
        }
        .alert("Camera scan unavailable", isPresented: $showCameraUnavailable) {
            Button("Paste pairing link") { pairingFieldFocused = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Camera scanning is available on a physical iPhone. Paste the pairing link from cmdSpace desktop instead.")
        }
        .onChange(of: remote.state) { _, state in
            if case .connecting = state { remote.pairingSheetOpen = false }
        }
    }

    private func connect() {
        onScanResult(pairingText.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private func scanQRCode() {
        guard DataScannerViewController.isSupported && DataScannerViewController.isAvailable else {
            showCameraUnavailable = true
            return
        }
        scannerOpen = true
    }

    private func pastePairingLink() {
        guard let link = UIPasteboard.general.string, link.hasPrefix("cmdspace://device-pair") else { return }
        pairingText = link
    }
}

private struct ScannerScreen: View {
    let onScan: (String) -> Void
    let onClose: () -> Void
    let onUnavailable: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            QRCodeScannerView(onScan: onScan, onUnavailable: onUnavailable)
                .ignoresSafeArea()
            Button("Cancel", action: onClose)
                .font(.system(size: 16, weight: .semibold))
                .padding(.horizontal, 16)
                .frame(height: 44)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
                .padding(.top, 12)
                .padding(.trailing, 20)
        }
    }
}

private struct DesktopConnectionCard: View {
    @EnvironmentObject private var remote: RemoteStore

    private var status: (title: String, detail: String, color: Color) {
        switch remote.state {
        case .connected:
            ("Desktop connected", "Your recent workspaces are ready.", CmdSpaceTheme.signal)
        case .connecting:
            ("Connecting", "Looking for your saved cmdSpace desktop…", CmdSpaceTheme.muted)
        case .failed:
            ("Connection needs updating", "Connect another desktop with a new QR code.", CmdSpaceTheme.muted)
        case .unpaired:
            remote.hasSavedDesktop
                ? ("Desktop offline", "Connect when your Mac is available.", CmdSpaceTheme.muted)
                : ("No desktop connected", "Connect a cmdSpace desktop to get started.", CmdSpaceTheme.muted)
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle().fill(status.color).frame(width: 8, height: 8).padding(.top, 4)
            VStack(alignment: .leading, spacing: 3) {
                Text(status.title).font(.system(size: 13, weight: .medium, design: .monospaced))
                Text(status.detail).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(12)
        .background(CmdSpaceTheme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private extension RemoteStore.State {
    var isPairingScreen: Bool {
        switch self {
        case .unpaired, .failed:
            true
        case .connecting, .connected:
            false
        }
    }
}

private struct ConnectingView: View {
    @EnvironmentObject private var remote: RemoteStore

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(CmdSpaceTheme.homeNav)
                        .frame(width: 78, height: 78)
                    Image(systemName: "desktopcomputer")
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(CmdSpaceTheme.homeAcid)
                    ProgressView()
                        .tint(CmdSpaceTheme.homeAcid)
                        .scaleEffect(1.55)
                        .offset(y: 54)
                }
                .padding(.bottom, 20)

                VStack(spacing: 7) {
                    Text("Connecting your desktop")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                    Text("Securing a connection to your cmdSpace desktop.")
                        .font(.system(size: 14))
                        .foregroundStyle(CmdSpaceTheme.homeMuted)
                        .multilineTextAlignment(.center)
                }

                Button { remote.cancelConnection() } label: {
                    Label("Cancel", systemImage: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                        .frame(minWidth: 120, minHeight: 44)
                        .background(CmdSpaceTheme.homeNav, in: Capsule())
                }
                .buttonStyle(CmdSpaceCardButtonStyle())
                .padding(.top, 4)
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(CmdSpaceTheme.homeLine))
            .padding(.horizontal, 28)
            Spacer()
        }
    }
}

private struct TerminalRemoteView: View {
    @EnvironmentObject private var remote: RemoteStore
    @AppStorage("cmdspace.terminal.font-size") private var terminalFontSize = 14.0
    @AppStorage("cmdspace.terminal.letter-spacing") private var letterSpacing = 0.0
    @AppStorage("cmdspace.terminal.scrollback") private var scrollback = 2000
    @State private var command = ""
    @State private var drawerOpen = false
    @State private var resizeTask: Task<Void, Never>?

    private var activeSession: RemoteSession? {
        remote.sessions.first { $0.id == remote.activeSessionId }
    }

    private var renderedOutput: String {
        TerminalDisplayText.normalize(remote.terminalText)
            .split(separator: "\n", omittingEmptySubsequences: false)
            .suffix(scrollback)
            .joined(separator: "\n")
    }

    private var inputMode: TerminalInputMode {
        TerminalInputMode.detect(in: renderedOutput)
    }

    private var inputPlaceholder: String {
        switch inputMode {
        case .codex: "Message Codex"
        case .shell: "Type a shell command"
        case .terminal: "Type in terminal"
        }
    }

    var body: some View {
        ZStack(alignment: .leading) {
            VStack(spacing: 0) {
                terminalHeader

                if activeSession == nil {
                    terminalEmptyCanvas
                    terminalActions
                } else {
                    terminalCanvas
                    if remote.activeTerminalReady {
                        terminalComposer
                    } else {
                        terminalPreparing
                    }
                }
            }
            .background(CmdSpaceTheme.terminal)

            if drawerOpen {
                CmdSpaceTheme.homeInk.opacity(0.40).ignoresSafeArea().onTapGesture { drawerOpen = false }
                DismissibleBottomSheet(onDismiss: { drawerOpen = false }) {
                    TerminalPickerSheet(close: { drawerOpen = false })
                        .frame(maxWidth: .infinity)
                        .frame(height: 420)
                        .background(CmdSpaceTheme.homePaper)
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26))
                }
            }
        }
    }

    private var terminalHeader: some View {
        HStack {
            Button { remote.closeWorkspace() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.terminalInk)
                    .frame(width: 36, height: 36)
                    .background(CmdSpaceTheme.terminalChrome, in: Circle())
            }
            .accessibilityLabel("Back to workspaces")

            Spacer()
            Button { drawerOpen = true } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.terminalInk)
                    .frame(width: 36, height: 36)
                    .background(CmdSpaceTheme.terminalChrome, in: Circle())
            }
            .accessibilityLabel("Terminal options")
        }
        .overlay {
            VStack(spacing: 2) {
                Text(remote.selectedWorkspace?.name ?? "cmdSpace")
                    .font(.system(size: 15, weight: .bold))
                    .lineLimit(1)
                HStack(spacing: 5) { Circle().fill(CmdSpaceTheme.homeAcid).frame(width: 6, height: 6); Text("Connected · SSH").font(.system(size: 10)) }
            }
            .foregroundStyle(CmdSpaceTheme.terminalInk)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Workspace \(remote.selectedWorkspace?.name ?? "cmdSpace")")
        }
        .padding(.horizontal, 16)
        .frame(height: 58)
        .background(CmdSpaceTheme.terminal)
        .overlay(alignment: .bottom) { Rectangle().fill(CmdSpaceTheme.terminalLine).frame(height: 1) }
    }

    private var terminalCanvas: some View {
        GeometryReader { proxy in
            ScrollViewReader { scrollProxy in
                ScrollView {
                    Text(renderedOutput)
                        .font(.system(size: terminalFontSize, weight: .regular, design: .monospaced))
                        .tracking(letterSpacing)
                        .foregroundStyle(CmdSpaceTheme.terminalInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .id("terminal-bottom")
                }
                .onChange(of: renderedOutput) { _, _ in
                    withAnimation(.easeOut(duration: 0.18)) {
                        scrollProxy.scrollTo("terminal-bottom", anchor: .bottom)
                    }
                }
                .onAppear { scheduleResize(for: proxy.size) }
                .onChange(of: proxy.size) { _, size in scheduleResize(for: size) }
                .onChange(of: remote.activeTerminalReady) { _, isReady in
                    if isReady { scheduleResize(for: proxy.size) }
                }
            }
        }
    }

    private var terminalEmptyCanvas: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Last login: connect a terminal from this workspace")
                .foregroundStyle(CmdSpaceTheme.terminalMuted)
            HStack(spacing: 0) {
                Text("cmdspace@\(remote.selectedWorkspace?.name ?? "workspace"):~$ ")
                    .foregroundStyle(CmdSpaceTheme.homeAcid)
                Text("_").foregroundStyle(CmdSpaceTheme.terminalInk)
            }
        }
        .font(.system(size: 12, design: .monospaced))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .background(CmdSpaceTheme.terminal)
        .onTapGesture { drawerOpen = true }
        .accessibilityLabel("No terminal selected. Open terminal options to select or create one.")
    }

    private var terminalActions: some View {
        TerminalKeyBar(send: remote.sendKey)
            .frame(maxWidth: .infinity, minHeight: 64)
            .padding(.horizontal, 12)
            .background(CmdSpaceTheme.terminalChrome)
    }

    private var terminalPreparing: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("Preparing terminal…")
                .font(.system(.footnote, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 82)
        .background(CmdSpaceTheme.terminal)
        .overlay(alignment: .top) { Divider() }
        .accessibilityElement(children: .combine)
    }

    private var terminalComposer: some View {
        VStack(spacing: 8) {
            if inputMode == .codex {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(CmdSpaceTheme.homeAcid)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Codex CLI is active")
                            .font(.system(size: 12, weight: .bold))
                        Text("Messages go to Codex, not the shell. Send `exit` to return to your shell.")
                            .font(.system(size: 11))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                    }
                    Button("Exit Codex") { remote.sendInput("exit\r") }
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeAcid)
                        .accessibilityLabel("Exit Codex and return to shell")
                    Spacer(minLength: 0)
                }
                .padding(10)
                .background(CmdSpaceTheme.panel, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .accessibilityElement(children: .combine)
            }
            TerminalKeyBar(send: remote.sendKey)
            HStack(spacing: 10) {
                HStack(spacing: 8) {
                    Text(">_")
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .foregroundStyle(CmdSpaceTheme.signal)
                    TerminalCommandField(text: $command, placeholder: inputPlaceholder, submit: sendCommand)
                }
                .padding(.horizontal, 14)
                .frame(height: 46)
                .background(CmdSpaceTheme.panel)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button(action: { sendCommand() }) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .frame(width: 46, height: 46)
                }
                .buttonStyle(TerminalSendButtonStyle(isEnabled: !command.isEmpty))
                .accessibilityLabel(inputMode == .codex ? "Send message to Codex" : "Send terminal input")
                .disabled(command.isEmpty)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(CmdSpaceTheme.terminal)
        .overlay(alignment: .top) { Divider() }
    }

    private func sendCommand(_ submittedCommand: String? = nil) {
        let value = submittedCommand ?? command
        guard let payload = TerminalCommandPayload.make(from: value) else { return }
        remote.sendInput(payload)
        command = ""
    }

    private func scheduleResize(for size: CGSize) {
        let cols = UInt16(max(1, min(400, Int((size.width - 32) / 8))))
        let rows = UInt16(max(1, min(200, Int((size.height - 32) / 18))))
        resizeTask?.cancel()
        resizeTask = Task {
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            remote.resizeActiveTerminal(cols: cols, rows: rows)
        }
    }
}

/// SwiftUI's `TextField.onSubmit` is not reliably invoked by the simulator's
/// software Return key when the terminal is streaming output.  The UIKit
/// delegate is the single submit path for both hardware and software Return.
private struct TerminalCommandField: UIViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let submit: (String) -> Void

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.delegate = context.coordinator
        field.font = .monospacedSystemFont(ofSize: 17, weight: .regular)
        field.textColor = .label
        field.backgroundColor = .clear
        field.tintColor = UIColor(CmdSpaceTheme.homeAcid)
        field.autocorrectionType = .no
        field.autocapitalizationType = .none
        field.returnKeyType = .send
        field.enablesReturnKeyAutomatically = false
        field.addTarget(
            context.coordinator,
            action: #selector(Coordinator.editingDidEndOnExit(_:)),
            for: .editingDidEndOnExit
        )
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        if field.text != text { field.text = text }
        field.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor.secondaryLabel]
        )
        context.coordinator.submit = submit
    }

    func makeCoordinator() -> Coordinator { Coordinator(text: $text, submit: submit) }

    final class Coordinator: NSObject, UITextFieldDelegate {
        @Binding private var text: String
        var submit: (String) -> Void
        private var isSubmittingReturn = false

        init(text: Binding<String>, submit: @escaping (String) -> Void) {
            _text = text
            self.submit = submit
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            text = textField.text ?? ""
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            submitReturn(from: textField)
            return false
        }

        @objc func editingDidEndOnExit(_ textField: UITextField) {
            submitReturn(from: textField)
        }

        private func submitReturn(from textField: UITextField) {
            guard !isSubmittingReturn else { return }
            isSubmittingReturn = true
            let value = textField.text ?? ""
            text = value
            submit(value)
            DispatchQueue.main.async { [weak self] in
                self?.isSubmittingReturn = false
            }
        }
    }
}

private struct WorkspaceDetailView: View {
    @EnvironmentObject private var remote: RemoteStore
    let openTerminal: () -> Void
    let openImport: () -> Void
    private var workspace: RemoteWorkspace? { remote.selectedWorkspace }
    private var sessions: [RemoteSession] { guard let workspace else { return [] }; return remote.sessions.filter { $0.workspaceId == workspace.id } }

    var body: some View {
        VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack { Button { remote.closeWorkspace() } label: { Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeInk).frame(width: 34, height: 34).background(CmdSpaceTheme.homeNav, in: Circle()) }.accessibilityLabel("Back to workspaces"); Spacer(); Image(systemName: "ellipsis").font(.system(size: 16, weight: .bold)).frame(width: 34, height: 34).background(CmdSpaceTheme.homeNav, in: Circle()) }
                        HStack(spacing: 10) { Image(systemName: "folder").font(.system(size: 20, weight: .semibold)).frame(width: 38, height: 38).background(CmdSpaceTheme.homeAcid, in: RoundedRectangle(cornerRadius: 12)); Text(workspace?.name ?? "Workspace").font(.system(size: 26, weight: .bold)).tracking(-1) }
                        Text(workspace?.workingFolder ?? "").font(.system(size: 12, design: .monospaced)).foregroundStyle(CmdSpaceTheme.homeMuted)
                        HStack(spacing: 10) { Button { remote.createTerminal() } label: { Label("New terminal", systemImage: "plus").font(.system(size: 13, weight: .bold)).foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 46).background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 15)) }; Button(action: openImport) { Label("Import session", systemImage: "rectangle.and.arrow.down").font(.system(size: 13, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeInk).frame(maxWidth: .infinity, minHeight: 46).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(CmdSpaceTheme.homeLine)) } }
                        Text("TERMINAL SESSIONS · \(sessions.count)").sectionLabel()
                        if sessions.isEmpty { Text("No sessions yet. Create a terminal or import a saved CLI session.").font(.system(size: 13)).foregroundStyle(CmdSpaceTheme.homeMuted).padding(.vertical, 24) }
                        ForEach(sessions) { session in Button { remote.attach(session); openTerminal() } label: { HStack(spacing: 12) { Image(systemName: "terminal").foregroundStyle(CmdSpaceTheme.homeAcid).frame(width: 42, height: 42).background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading, spacing: 3) { Text(session.title).font(.system(size: 15, weight: .bold)); Text(session.cwd ?? "Remote terminal").font(.system(size: 11, design: .monospaced)).foregroundStyle(CmdSpaceTheme.homeMuted).lineLimit(1) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(CmdSpaceTheme.homeMuted) }.padding(12).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(CmdSpaceTheme.homeLine)) }.buttonStyle(.plain) }
                    }.padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 20)
                }.scrollIndicators(.hidden)
            .background(CmdSpaceTheme.homePaper)
        }.task { remote.refreshSessions() }
    }
}

private struct ImportSessionsView: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    let openTerminal: () -> Void
    @State private var thisWorkspace = true
    @State private var query = ""
    @State private var provider = "All agents"
    @State private var selected = Set<String>()

    private var workspace: RemoteWorkspace? { remote.selectedWorkspace }
    private var available: [RemoteImportableSession] {
        remote.importableSessions.filter { session in
            (provider == "All agents" || session.provider.capitalized == provider)
                && (query.isEmpty || session.title.localizedCaseInsensitiveContains(query) || session.preview.localizedCaseInsensitiveContains(query))
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Import terminal sessions").font(.system(size: 21, weight: .bold)).tracking(-0.4)
                            Text("Resume a CLI session in \(workspace?.name ?? "this workspace").").font(.system(size: 12)).foregroundStyle(CmdSpaceTheme.homeMuted)
                        }
                        Spacer()
                        Button(action: close) { Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeInk).frame(width: 34, height: 34).background(CmdSpaceTheme.homeNav, in: Circle()) }
                            .accessibilityLabel("Close import sessions")
                    }
                    Picker("Session scope", selection: $thisWorkspace) {
                        Text("This workspace").tag(true)
                        Text("All sessions").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: thisWorkspace) { _, value in refresh(value) }

                    HStack(spacing: 9) { Image(systemName: "magnifyingglass").foregroundStyle(CmdSpaceTheme.homeMuted); TextField("Search sessions", text: $query).font(.system(size: 13)) }
                        .padding(.horizontal, 14).frame(height: 46).background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 13))
                    Menu { Button("All agents") { provider = "All agents" }; ForEach(Array(Set(remote.importableSessions.map { $0.provider.capitalized })).sorted(), id: \.self) { name in Button(name) { provider = name } } } label: {
                        HStack { Text(provider).font(.system(size: 12, weight: .semibold)); Spacer(); Image(systemName: "chevron.up.chevron.down").font(.system(size: 10, weight: .bold)) }
                            .foregroundStyle(CmdSpaceTheme.homeInk).padding(.horizontal, 14).frame(height: 38).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(CmdSpaceTheme.homeLine))
                    }
                    Text("\(workspace?.workingFolder.uppercased() ?? "SESSIONS") · \(available.count) AVAILABLE").font(.system(size: 10, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted)
                    if remote.importSessionsLoading {
                        ProgressView("Finding desktop sessions…").frame(maxWidth: .infinity).padding(.vertical, 38)
                    } else if available.isEmpty {
                        VStack(spacing: 10) { Image(systemName: "terminal").font(.system(size: 28)).foregroundStyle(CmdSpaceTheme.homeMuted); Text("No saved sessions found").font(.system(size: 16, weight: .bold)); Text("Open a supported CLI session on your desktop, then pull to refresh.").multilineTextAlignment(.center).font(.system(size: 13)).foregroundStyle(CmdSpaceTheme.homeMuted) }.frame(maxWidth: .infinity).padding(.vertical, 54)
                    } else {
                        VStack(spacing: 0) { ForEach(available) { session in sessionRow(session); if session.id != available.last?.id { Divider().padding(.leading, 56) } } }
                            .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(CmdSpaceTheme.homeLine))
                    }
                }.padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 28)
            }
            .refreshable { refresh(thisWorkspace) }
            HStack { Text("\(selected.count) selected").font(.system(size: 12, weight: .medium)).foregroundStyle(CmdSpaceTheme.homeMuted); Spacer(); Button { remote.importSessions(Array(selected)); openTerminal() } label: { Text("Add \(selected.count) \(selected.count == 1 ? "session" : "sessions")").font(.system(size: 12, weight: .bold)).foregroundStyle(.white).padding(.horizontal, 18).frame(height: 46).background(selected.isEmpty ? CmdSpaceTheme.homeMuted : CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 14)) }.disabled(selected.isEmpty) }
                .padding(.horizontal, 20).padding(.vertical, 14).background(CmdSpaceTheme.homePaper).overlay(alignment: .top) { Divider() }
        }
        .background(CmdSpaceTheme.homePaper.ignoresSafeArea())
        .task { refresh(thisWorkspace) }
    }

    @ViewBuilder private func sessionRow(_ session: RemoteImportableSession) -> some View {
        let isSelected = selected.contains(session.id)
        Button {
            guard !session.active else { return }
            if isSelected { selected.remove(session.id) } else { selected.insert(session.id) }
        } label: {
            HStack(spacing: 11) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle").foregroundStyle(isSelected ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeMuted).font(.system(size: 18))
                Text(session.providerIcon).font(.system(size: 15, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeInk).frame(width: 36, height: 36).background(session.providerColor, in: RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) { HStack(spacing: 6) { Text(session.title).font(.system(size: 13, weight: .bold)).lineLimit(1); Text(session.provider.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted) }; Text(session.preview.isEmpty ? session.cwd : session.preview).font(.system(size: 10)).foregroundStyle(CmdSpaceTheme.homeMuted).lineLimit(1); Text(session.cwd).font(.system(size: 9, design: .monospaced)).foregroundStyle(CmdSpaceTheme.homeMuted).lineLimit(1) }
                Spacer(minLength: 4); Text(session.relativeActivity).font(.system(size: 9)).foregroundStyle(CmdSpaceTheme.homeMuted)
            }.padding(12).opacity(session.active ? 0.48 : 1)
        }.buttonStyle(.plain).disabled(session.active)
    }

    private func refresh(_ workspaceOnly: Bool) {
        guard let workspace else { return }
        selected.removeAll()
        remote.refreshImportableSessions(workspace: workspace, workspaceOnly: workspaceOnly)
    }
}

private extension RemoteImportableSession {
    var providerIcon: String {
        switch provider.lowercased() {
        case "claude": return "✣"
        case "codex": return "✦"
        case "cmd": return ">_"
        default: return "•"
        }
    }

    var providerColor: Color {
        switch provider.lowercased() {
        case "claude": return Color(red: 0.88, green: 0.98, blue: 0.75)
        case "codex": return Color(red: 0.86, green: 0.94, blue: 1.0)
        default: return CmdSpaceTheme.homeNav
        }
    }

    var relativeActivity: String {
        guard lastActivityAt > 0 else { return "" }
        let elapsed = max(0, Date().timeIntervalSince1970 - Double(lastActivityAt) / 1_000)
        if elapsed < 60 { return "Now" }
        if elapsed < 3_600 { return "\(Int(elapsed / 60))m ago" }
        if elapsed < 86_400 { return "\(Int(elapsed / 3_600))h ago" }
        return "\(Int(elapsed / 86_400))d ago"
    }
}

private struct TerminalKeyBar: View {
    let send: (String) -> Void

    private let keys: [(label: String, sequence: String)] = [
        ("⌃C", "\u{0003}"),
        ("Esc", "\u{001B}"),
        ("Tab", "\t"),
        ("←", "\u{001B}[D"),
        ("↓", "\u{001B}[B"),
        ("↑", "\u{001B}[A"),
        ("→", "\u{001B}[C"),
        ("↵", "\r"),
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(Array(keys.enumerated()), id: \.offset) { _, key in
                    Button(key.label) { send(key.sequence) }
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundStyle(.primary)
                        .frame(minWidth: 44, minHeight: 36)
                        .accessibilityLabel(key.label)
                    if key.label != keys.last?.label {
                        Divider()
                            .frame(height: 20)
                    }
                }
            }
        }
    }
}

private struct TerminalPickerSheet: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    private var sessions: [RemoteSession] { guard let workspace = remote.selectedWorkspace else { return [] }; return remote.sessions.filter { $0.workspaceId == workspace.id } }

    var body: some View {
        ZStack(alignment: .top) {
            SheetHandle()
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text("Select terminal").font(.system(size: 21, weight: .bold)); Spacer(); Button(action: close) { Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeInk).frame(width: 34, height: 34).background(CmdSpaceTheme.homeNav, in: Circle()) }.accessibilityLabel("Close terminal selector") }
                if sessions.isEmpty { ContentUnavailableView("No terminals", systemImage: "terminal", description: Text("Create one for this workspace.")) }
                ForEach(sessions) { session in Button { remote.attach(session); close() } label: { HStack(spacing: 12) { Image(systemName: "terminal").foregroundStyle(CmdSpaceTheme.homeAcid).frame(width: 38, height: 38).background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading, spacing: 2) { Text(session.title).font(.system(size: 14, weight: .bold)); Text(session.cwd ?? "Remote terminal").font(.system(size: 10, design: .monospaced)).foregroundStyle(CmdSpaceTheme.homeMuted).lineLimit(1) }; Spacer(); if session.id == remote.activeSessionId { Image(systemName: "checkmark.circle.fill").foregroundStyle(CmdSpaceTheme.homeAcid) } }.padding(12).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(CmdSpaceTheme.homeLine)) }.buttonStyle(.plain) }
                Button { remote.createTerminal() } label: { Label("New terminal", systemImage: "plus").font(.system(size: 14, weight: .bold)).frame(maxWidth: .infinity, minHeight: 48).foregroundStyle(.white).background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 14)) }
            }.padding(.top, 38).padding(.horizontal, 20).padding(.bottom, 24)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

private struct WorkspaceDrawer: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    private var workspaceSessions: [RemoteSession] {
        guard let workspace = remote.selectedWorkspace else { return remote.sessions }
        return remote.sessions.filter { $0.workspaceId == workspace.id }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Button { remote.closeWorkspace() } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 28, height: 28)
                }
                .accessibilityLabel("Back to recent workspaces")
                Text(remote.selectedWorkspace?.name ?? "Workspaces")
                    .font(.system(.headline, design: .monospaced))
                Spacer()
                Button { remote.refreshSessions() } label: { Image(systemName: "arrow.clockwise") }
                    .accessibilityLabel("Refresh terminals")
                Button(action: close) { Image(systemName: "xmark") }
                    .accessibilityLabel("Close terminals")
            }
            if !remote.hasLoadedSessions {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Loading terminals…").font(.system(.footnote, design: .monospaced))
                }
                .foregroundStyle(.secondary)
                .padding(12)
            } else if workspaceSessions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("No terminal in this workspace")
                        .font(.system(.body, design: .monospaced))
                    Text("Start a standard terminal in this workspace, or open one on cmdSpace desktop and refresh.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(CmdSpaceTheme.panel)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                ForEach(workspaceSessions) { session in
                    Button { remote.attach(session); close() } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(session.title).font(.system(.body, design: .monospaced))
                            Text(session.cwd ?? "Remote terminal").font(.system(.caption2, design: .monospaced)).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(CmdSpaceTheme.panel)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer()
            Button("New terminal") { remote.createTerminal() }
                .buttonStyle(CmdSpaceButtonStyle())
                .disabled(!remote.hasLoadedSessions)
            Button("Disconnect") { remote.disconnect() }.buttonStyle(CmdSpaceButtonStyle())
        }
        .padding(20)
        .frame(width: 330)
        .frame(maxHeight: .infinity, alignment: .topLeading)
        .background(CmdSpaceTheme.canvas)
        .overlay(alignment: .trailing) { Divider() }
        .shadow(color: .black.opacity(0.35), radius: 18, x: 8)
        .onAppear { remote.refreshSessions() }
    }
}

private enum CmdSpaceTheme {
    static let canvas = color(dark: .init(white: 0.031, alpha: 1), light: .init(white: 0.96, alpha: 1))
    static let panel = color(dark: .init(red: 0.095, green: 0.085, blue: 0.09, alpha: 1), light: .white)
    static let terminal = color(dark: .init(red: 0.018, green: 0.018, blue: 0.022, alpha: 1), light: .init(white: 0.985, alpha: 1))
    static let terminalInk = color(dark: .init(white: 0.94, alpha: 1), light: .init(red: 0.063, green: 0.067, blue: 0.078, alpha: 1))
    static let terminalMuted = color(dark: .init(red: 0.514, green: 0.565, blue: 0.584, alpha: 1), light: .init(red: 0.38, green: 0.40, blue: 0.43, alpha: 1))
    static let terminalChrome = color(dark: .init(red: 0.125, green: 0.153, blue: 0.169, alpha: 1), light: .init(red: 0.918, green: 0.922, blue: 0.906, alpha: 1))
    static let terminalLine = color(dark: .init(red: 0.176, green: 0.204, blue: 0.22, alpha: 1), light: .init(red: 0.84, green: 0.85, blue: 0.84, alpha: 1))
    static let signal = color(dark: .init(red: 0.57, green: 0.78, blue: 0.45, alpha: 1), light: .init(red: 0.25, green: 0.46, blue: 0.17, alpha: 1))
    static let accent = color(dark: .init(red: 0.30, green: 0.66, blue: 0.98, alpha: 1), light: .init(red: 0.0, green: 0.38, blue: 0.78, alpha: 1))
    static let muted = color(dark: .init(red: 0.49, green: 0.47, blue: 0.5, alpha: 1), light: .init(red: 0.34, green: 0.32, blue: 0.36, alpha: 1))
    static let separator = color(dark: .init(white: 1, alpha: 0.08), light: .init(white: 0, alpha: 0.08))
    static let primaryAction = color(dark: .init(white: 0.94, alpha: 1), light: .black)
    static let primaryActionLabel = color(dark: .black, light: .white)
    static let homePaper = color(dark: .init(red: 0.055, green: 0.059, blue: 0.065, alpha: 1), light: .init(red: 0.969, green: 0.969, blue: 0.961, alpha: 1))
    static let homeInk = color(dark: .init(white: 0.96, alpha: 1), light: .init(red: 0.063, green: 0.067, blue: 0.078, alpha: 1))
    static let homeMuted = color(dark: .init(red: 0.56, green: 0.57, blue: 0.60, alpha: 1), light: .init(red: 0.443, green: 0.455, blue: 0.478, alpha: 1))
    static let homeLine = color(dark: .init(white: 1, alpha: 0.10), light: .init(red: 0.894, green: 0.898, blue: 0.882, alpha: 1))
    static let homeCard = color(dark: .init(red: 0.095, green: 0.10, blue: 0.11, alpha: 1), light: .white)
    static let homeNav = color(dark: .init(red: 0.13, green: 0.14, blue: 0.15, alpha: 1), light: .init(red: 0.918, green: 0.922, blue: 0.906, alpha: 1))
    static let homePrimaryAction = color(dark: .init(red: 0.12, green: 0.13, blue: 0.15, alpha: 1), light: .init(red: 0.063, green: 0.067, blue: 0.078, alpha: 1))
    static let homeError = Color(red: 0.95, green: 0.37, blue: 0.31)
    static let homeSelection = color(dark: .init(red: 0.10, green: 0.16, blue: 0.20, alpha: 1), light: .init(red: 0.918, green: 0.965, blue: 1, alpha: 1))
    static let workspaceTip = color(dark: .init(red: 0.54, green: 0.78, blue: 0.65, alpha: 1), light: .init(red: 0.224, green: 0.451, blue: 0.361, alpha: 1))
    static let workspaceTipSurface = color(dark: .init(red: 0.09, green: 0.15, blue: 0.12, alpha: 1), light: .init(red: 0.933, green: 0.961, blue: 0.945, alpha: 1))
    static let homeQuickConnect = color(
        dark: .init(red: 0.078, green: 0.082, blue: 0.098, alpha: 1),
        light: .init(red: 0.063, green: 0.067, blue: 0.078, alpha: 1)
    )
    static let homeAcid = Color(red: 0.722, green: 1, blue: 0.173)

    static func workspaceMark(index: Int) -> Color {
        switch index {
        case 0: return homeAcid
        case 1: return Color(red: 0.616, green: 0.847, blue: 1)
        default: return Color(red: 0.969, green: 0.773, blue: 0.424)
        }
    }

    private static func color(dark: UIColor, light: UIColor) -> Color {
        Color(uiColor: UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light })
    }
}

private struct CmdSpaceLogo: View {
    @Environment(\.colorScheme) private var colorScheme
    let size: CGFloat

    var body: some View {
        Group {
            let imageName = colorScheme == .dark ? "logo.png" : "logo-light.png"
            if let image = UIImage(named: imageName) {
                if colorScheme == .dark {
                    Image(uiImage: image).resizable().scaledToFit().colorInvert()
                } else {
                    Image(uiImage: image).resizable().scaledToFit()
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.26))
    }
}

private struct FilesWorkspaceView: View {
    @EnvironmentObject private var remote: RemoteStore
    let selectHome: () -> Void
    @State private var searchText = ""
    @State private var previewOpen = false
    @State private var newFolderOpen = false
    @State private var newFolderName = ""

    private var workspace: RemoteWorkspace? { remote.selectedWorkspace ?? remote.recentWorkspaces.first }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Files").font(.system(size: 30, weight: .bold)).tracking(-1.2)
                            Text(workspace.map { "\($0.name) workspace" } ?? "Choose a workspace to browse")
                                .font(.system(size: 13)).foregroundStyle(CmdSpaceTheme.homeMuted)
                        }
                        Spacer()
                        Image(systemName: "ellipsis").frame(width: 42, height: 42)
                            .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 14))
                    }
                    Label(remote.directoryPath.isEmpty ? (workspace?.workingFolder ?? "No workspace selected") : remote.directoryPath, systemImage: "folder")
                        .font(.system(size: 11, design: .monospaced)).lineLimit(1)
                        .foregroundStyle(CmdSpaceTheme.homeInk).padding(.horizontal, 12).frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
                        .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 13))
                    HStack(spacing: 5) {
                        Text("Files").font(.system(size: 12, weight: .bold)).foregroundStyle(.white).padding(.horizontal, 14).frame(height: 32).background(CmdSpaceTheme.homePrimaryAction, in: Capsule())
                        Text("Changes").font(.system(size: 12, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted).padding(.horizontal, 14).frame(height: 32)
                    }.padding(4).background(CmdSpaceTheme.homeNav, in: Capsule())
                    HStack(spacing: 9) { Image(systemName: "magnifyingglass"); TextField("Search files", text: $searchText) }
                        .foregroundStyle(CmdSpaceTheme.homeMuted).padding(.horizontal, 13).frame(height: 46).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(CmdSpaceTheme.homeLine))
                    HStack(spacing: 10) {
                        Label("Upload", systemImage: "arrow.up").foregroundStyle(CmdSpaceTheme.homeMuted)
                        Button { newFolderOpen = true } label: { Label("New folder", systemImage: "folder.badge.plus") }.disabled(workspace == nil || remote.directoryPath.isEmpty)
                    }.font(.system(size: 12, weight: .bold))
                    Text("DIRECTORY").sectionLabel()
                    if let workspace, remote.directoryPath != workspace.workingFolder {
                        Button { remote.browseDirectory(workspace: workspace, path: (remote.directoryPath as NSString).deletingLastPathComponent) } label: {
                            Label("Parent folder", systemImage: "arrow.turn.up.left").font(.system(size: 13, weight: .semibold)).frame(minHeight: 44)
                        }.foregroundStyle(CmdSpaceTheme.homeInk)
                    }
                    if remote.directoryLoading {
                        ProgressView("Loading directory…").frame(maxWidth: .infinity, minHeight: 120)
                    } else if let error = remote.directoryError {
                        ContentUnavailableView("Could not load this folder", systemImage: "exclamationmark.triangle", description: Text(error))
                    } else if remote.directoryEntries.isEmpty {
                        ContentUnavailableView("This folder is empty", systemImage: "folder")
                    } else { VStack(spacing: 0) {
                        ForEach(remote.directoryEntries.filter { searchText.isEmpty || $0.name.localizedCaseInsensitiveContains(searchText) }) { entry in
                            Button { if entry.isDirectory, let workspace { remote.browseDirectory(workspace: workspace, path: entry.path) } else if let workspace { remote.previewFile(workspace: workspace, path: entry.path) } } label: {
                                HStack(spacing: 12) { Image(systemName: entry.isDirectory ? "folder.fill" : "doc.text").foregroundStyle(entry.isDirectory ? CmdSpaceTheme.homeAcid : CmdSpaceTheme.homeMuted); Text(entry.name).font(.system(size: 14, weight: .medium)).lineLimit(1); Spacer(); if entry.isDirectory { Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted) } }.padding(.horizontal, 14).frame(height: 48)
                            }.buttonStyle(.plain)
                            if entry.id != remote.directoryEntries.last?.id { Divider().overlay(CmdSpaceTheme.homeLine).padding(.leading, 14) }
                        }
                    }.background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(CmdSpaceTheme.homeLine)) }
                }.padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 16)
            }.scrollIndicators(.hidden)
            HomeTabBar(selectedTab: .files, homeAction: selectHome, openSessions: {}, openFiles: {}, openSettings: {})
        }.background(CmdSpaceTheme.homePaper).task(id: workspace?.id) { if let workspace { remote.browseDirectory(workspace: workspace) } }
        .onChange(of: remote.previewedFile?.path) { _, value in previewOpen = value != nil }
        .sheet(isPresented: $previewOpen) { if let file = remote.previewedFile { NavigationStack { ScrollView { Text(file.content).font(.system(size: 12, design: .monospaced)).frame(maxWidth: .infinity, alignment: .leading).padding() }.navigationTitle(URL(fileURLWithPath: file.path).lastPathComponent).toolbar { Button("Done") { previewOpen = false } } } } }
        .alert("New folder", isPresented: $newFolderOpen) { TextField("Folder name", text: $newFolderName); Button("Create") { if let workspace { remote.createDirectory(workspace: workspace, parent: remote.directoryPath, name: newFolderName) }; newFolderName = "" }; Button("Cancel", role: .cancel) { newFolderName = "" } } message: { Text("Create inside the current folder.") }
    }
}

private struct SessionsWorkspaceView: View {
    @EnvironmentObject private var remote: RemoteStore
    let selectHome: () -> Void
    let openTerminal: () -> Void
    private var workspace: RemoteWorkspace? { remote.selectedWorkspace ?? remote.recentWorkspaces.first }
    private var sessions: [RemoteSession] { guard let workspace else { return [] }; return remote.sessions.filter { $0.workspaceId == workspace.id } }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack { VStack(alignment: .leading, spacing: 4) { Text("Sessions").font(.system(size: 30, weight: .bold)).tracking(-1.2); Text(workspace.map { "\($0.name) workspace" } ?? "Choose a workspace").font(.system(size: 13)).foregroundStyle(CmdSpaceTheme.homeMuted) }; Spacer(); Button { remote.refreshSessions() } label: { Image(systemName: "arrow.clockwise").frame(width: 42, height: 42).background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 14)) } }
                    Text("TERMINALS").sectionLabel()
                    if sessions.isEmpty { ContentUnavailableView("No sessions", systemImage: "terminal", description: Text("Create a terminal in this workspace to start.")) }
                    ForEach(sessions) { session in Button { remote.attach(session); openTerminal() } label: { HStack(spacing: 12) { Image(systemName: "terminal").font(.system(size: 18)).foregroundStyle(CmdSpaceTheme.homeAcid).frame(width: 42, height: 42).background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading, spacing: 3) { Text(session.title).font(.system(size: 15, weight: .bold)); Text(session.cwd ?? workspace?.workingFolder ?? "").font(.system(size: 11, design: .monospaced)).foregroundStyle(CmdSpaceTheme.homeMuted).lineLimit(1) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(CmdSpaceTheme.homeMuted) }.padding(12).background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(CmdSpaceTheme.homeLine)) }.buttonStyle(.plain) }
                    Button { remote.createTerminal() } label: { Label("New terminal", systemImage: "plus").frame(maxWidth: .infinity).frame(height: 46).background(CmdSpaceTheme.homePrimaryAction, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white) }.disabled(workspace == nil || !remote.hasLoadedSessions)
                }.padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 16)
            }.scrollIndicators(.hidden)
            HomeTabBar(selectedTab: .sessions, homeAction: selectHome, openSessions: {}, openFiles: {}, openSettings: {})
        }.background(CmdSpaceTheme.homePaper).task { remote.refreshSessions() }
    }
}

private struct CmdSpaceSettingsView: View {
    @AppStorage("cmdspace.terminal.font-size") private var terminalFontSize = 14.0
    @AppStorage("cmdspace.terminal.letter-spacing") private var letterSpacing = 0.0
    @AppStorage("cmdspace.terminal.scrollback") private var scrollback = 2000
    let selectHome: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Settings")
                            .font(.system(size: 30, weight: .bold))
                            .tracking(-1.2)
                        Text("Tune your terminal workspace.")
                            .font(.system(size: 14))
                            .foregroundStyle(CmdSpaceTheme.homeMuted)
                    }

                    Text("EDITOR").sectionLabel()
                    settingsCard {
                        settingToggle(title: "Vim mode", detail: "Enable Vim keybindings in the code editor.")
                        Divider()
                        settingToggle(title: "Copy selected text", detail: "Copy terminal text after a selection settles.")
                    }

                    Text("TERMINAL FONT").sectionLabel()
                    settingsCard {
                        settingMenu(title: "Letter spacing", detail: "Extra horizontal space between characters.", value: String(format: "%.0f px", letterSpacing)) {
                            Picker("Letter spacing", selection: $letterSpacing) {
                                ForEach([-1.0, 0.0, 1.0, 2.0], id: \.self) { Text(String(format: "%.0f px", $0)).tag($0) }
                            }
                        }
                        Divider()
                        settingMenu(title: "Font size", detail: "Terminal text size.", value: String(format: "%.0f px", terminalFontSize)) {
                            Picker("Font size", selection: $terminalFontSize) {
                                ForEach([8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0], id: \.self) { Text(String(format: "%.0f px", $0)).tag($0) }
                            }
                        }
                        Divider()
                        settingMenu(title: "Scrollback", detail: "Lines of history kept per terminal.", value: "\(scrollback.formatted())") {
                            Picker("Scrollback", selection: $scrollback) {
                                ForEach([500, 1000, 2000, 5000, 10000], id: \.self) { Text($0.formatted()).tag($0) }
                            }
                        }
                    }

                    Text("THEME").sectionLabel()
                    settingsCard {
                        HStack(spacing: 12) {
                            HStack(spacing: 4) {
                                Capsule().fill(Color(red: 0.20, green: 0.54, blue: 0.76)).frame(width: 8, height: 28)
                                Capsule().fill(Color(red: 0.32, green: 0.40, blue: 0.48)).frame(width: 8, height: 28)
                                Capsule().fill(Color(red: 0.84, green: 0.92, blue: 0.98)).frame(width: 8, height: 28)
                            }
                            .frame(width: 50, height: 50)
                            .background(Color(red: 0.93, green: 0.97, blue: 1), in: RoundedRectangle(cornerRadius: 16))
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Liquid Glass").font(.system(size: 15, weight: .bold))
                                Text("Iridescent glass surfaces").font(.system(size: 12)).foregroundStyle(CmdSpaceTheme.homeMuted)
                            }
                            Spacer()
                            Text("Soon").comingSoon()
                        }
                    }

                    Text("TERMINAL BACKGROUND").sectionLabel()
                    settingsCard {
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("guest@cmdspace:~ $").foregroundStyle(CmdSpaceTheme.homeAcid)
                                Text("ssh production").foregroundStyle(.white.opacity(0.9))
                            }
                            .font(.system(size: 11, design: .monospaced))
                            .padding(12)
                            .frame(maxWidth: .infinity, minHeight: 78, alignment: .leading)
                            .background(Color(red: 0.094, green: 0.125, blue: 0.153), in: RoundedRectangle(cornerRadius: 12))
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Custom background").font(.system(size: 15, weight: .bold))
                                    Text("Set an image or video for terminals.").font(.system(size: 12)).foregroundStyle(CmdSpaceTheme.homeMuted)
                                }
                                Spacer()
                                Text("Soon").comingSoon()
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 16)
            }
            .scrollIndicators(.hidden)

            HomeTabBar(selectedTab: .settings, homeAction: selectHome, openSessions: {}, openFiles: {}, openSettings: {})
        }
        .background(CmdSpaceTheme.homePaper)
    }

    private func settingsCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 14, content: content)
            .padding(16)
            .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(CmdSpaceTheme.homeLine))
    }

    private func settingToggle(title: String, detail: String) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 15, weight: .bold))
                Text(detail).font(.system(size: 12)).foregroundStyle(CmdSpaceTheme.homeMuted)
            }
            Spacer()
            Text("Soon").comingSoon()
        }
    }

    private func settingMenu<Content: View>(title: String, detail: String, value: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 15, weight: .bold))
                Text(detail).font(.system(size: 12)).foregroundStyle(CmdSpaceTheme.homeMuted)
            }
            Spacer()
            Menu(content: content) {
                Label(value, systemImage: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(CmdSpaceTheme.homeInk)
                    .frame(minWidth: 74, minHeight: 34)
                    .background(CmdSpaceTheme.homeNav, in: Capsule())
            }
        }
    }
}

private struct AppearancePopup: View {
    @AppStorage(AppearancePreference.storageKey) private var appearanceRawValue = AppearancePreference.system.rawValue
    let close: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Appearance").font(.system(size: 17, weight: .bold))
                Spacer()
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(CmdSpaceTheme.homeInk)
                        .frame(width: 34, height: 34)
                        .background(CmdSpaceTheme.homeNav, in: Circle())
                }
                    .accessibilityLabel("Close appearance")
            }
            Text("Choose the theme for cmdSpace.")
                .font(.system(size: 13))
                .foregroundStyle(CmdSpaceTheme.homeMuted)
            HStack(spacing: 4) {
                appearanceButton(.light, symbol: "sun.max", title: "Light")
                appearanceButton(.dark, symbol: "moon", title: "Dark")
            }
            .padding(5)
            .background(CmdSpaceTheme.homeNav, in: RoundedRectangle(cornerRadius: 15))
        }
        .padding(18)
        .background(CmdSpaceTheme.homeCard, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(CmdSpaceTheme.homeLine))
        .shadow(color: CmdSpaceTheme.homeInk.opacity(0.13), radius: 24, y: 10)
    }

    private func appearanceButton(_ appearance: AppearancePreference, symbol: String, title: String) -> some View {
        let isSelected = appearanceRawValue == appearance.rawValue
        return Button { appearanceRawValue = appearance.rawValue } label: {
            Label(title, systemImage: symbol)
                .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                .foregroundStyle(isSelected ? CmdSpaceTheme.homeInk : CmdSpaceTheme.homeMuted)
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(isSelected ? CmdSpaceTheme.homeCard : .clear, in: RoundedRectangle(cornerRadius: 11))
        }
    }
}

private extension Text {
    func sectionLabel() -> some View {
        font(.system(size: 13, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted)
    }

    func comingSoon() -> some View {
        font(.system(size: 11, weight: .bold)).foregroundStyle(CmdSpaceTheme.homeMuted)
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(CmdSpaceTheme.homeNav, in: Capsule())
    }
}
private struct CmdSpaceButtonStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label.font(.system(.body, design: .monospaced)).frame(maxWidth: .infinity).padding(13).background(CmdSpaceTheme.panel.opacity(configuration.isPressed ? 0.6 : 1)).overlay(RoundedRectangle(cornerRadius: 10).stroke(.gray.opacity(0.45))).clipShape(RoundedRectangle(cornerRadius: 10)) } }

private struct CmdSpaceCardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.72 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct CmdSpacePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold, design: .monospaced))
            .foregroundStyle(CmdSpaceTheme.primaryActionLabel)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(CmdSpaceTheme.primaryAction.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct TerminalSendButtonStyle: ButtonStyle {
    let isEnabled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isEnabled ? CmdSpaceTheme.primaryActionLabel : CmdSpaceTheme.muted)
            .background(isEnabled ? CmdSpaceTheme.primaryAction.opacity(configuration.isPressed ? 0.78 : 1) : CmdSpaceTheme.panel)
            .clipShape(Circle())
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
