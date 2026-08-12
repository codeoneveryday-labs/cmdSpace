import SwiftUI
import VisionKit

struct RootView: View {
    @EnvironmentObject private var remote: RemoteStore

    var body: some View {
        Group {
            switch remote.state {
            case .unpaired, .failed: PairDeviceView()
            case .connecting: ConnectingView()
            case .connected: TerminalRemoteView()
            }
        }
        .tint(CmdSpaceTheme.signal)
        .background(CmdSpaceTheme.canvas.ignoresSafeArea())
    }
}

private struct PairDeviceView: View {
    @EnvironmentObject private var remote: RemoteStore
    @State private var pairingText = ""
    @State private var scannerOpen = false
    @State private var settingsOpen = false

    var body: some View {
        ZStack {
            VStack(spacing: 20) {
                Spacer()
                CmdSpaceLogo(size: 68)
                Text("cmdSpace").font(.system(size: 30, weight: .semibold, design: .serif))
                Text("Your desktop, in reach.").font(.system(.footnote, design: .monospaced)).foregroundStyle(.secondary)
                if remote.hasSavedDesktop {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Circle().fill(CmdSpaceTheme.signal).frame(width: 7, height: 7); Text("Saved cmdSpace desktop").font(.system(.body, design: .monospaced)); Spacer(); Text("Reconnect").font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary) }
                        Text("Native device identity saved in Keychain").font(.system(.caption2, design: .monospaced)).foregroundStyle(.secondary)
                    }.padding(14).background(CmdSpaceTheme.panel).clipShape(RoundedRectangle(cornerRadius: 12)).padding(.horizontal, 24)
                    Button("Reconnect") { remote.reconnectSavedDesktop() }.buttonStyle(CmdSpaceButtonStyle()).padding(.horizontal, 24)
                }
                Button("Scan cmdSpace QR Code") { scannerOpen = true }
                    .buttonStyle(CmdSpaceButtonStyle()).padding(.horizontal, 24)
                if case let .failed(error) = remote.state { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center).padding(.horizontal, 24) }
                Spacer()
                Link(destination: URL(string: "https://github.com/codeoneveryday-labs/cmdSpace")!) {
                    HStack(spacing: 7) {
                        Image("GitHubMark")
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 16, height: 16)
                        Text("GitHub").font(.system(size: 11, design: .monospaced))
                    }
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                }
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .overlay(alignment: .topTrailing) {
            Button { settingsOpen = true } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 19, weight: .light))
                    .foregroundStyle(.secondary)
                    .frame(width: 44, height: 44)
            }
                .accessibilityLabel("Settings")
                .padding(.top, 8)
                .padding(.trailing, 16)
        }
        .sheet(isPresented: $settingsOpen) { CmdSpaceSettingsView(close: { settingsOpen = false }) }
        .sheet(isPresented: $remote.pairingSheetOpen) {
            NavigationStack {
                VStack(spacing: 16) {
                    Text("Pair a cmdSpace desktop").font(.system(.title2, design: .serif))
                    Text("Camera scanning is enabled in the Xcode app target. Paste a pairing payload here for local development.").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    TextField("cmdspace://device-pair…", text: $pairingText, axis: .vertical).textInputAutocapitalization(.never).autocorrectionDisabled().font(.system(.caption, design: .monospaced)).padding(12).background(CmdSpaceTheme.panel).clipShape(RoundedRectangle(cornerRadius: 10))
                    Button("Pair this desktop") { remote.pairingSheetOpen = false; remote.pair(from: pairingText) }.buttonStyle(CmdSpaceButtonStyle()).disabled(pairingText.isEmpty)
                    Spacer()
                }.padding().background(CmdSpaceTheme.canvas.ignoresSafeArea()).toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { remote.pairingSheetOpen = false } } }
            }.preferredColorScheme(.dark)
        }
        .sheet(isPresented: $scannerOpen) {
            if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                QRCodeScannerView(onScan: { payload in scannerOpen = false; remote.pair(from: payload) }, onUnavailable: { scannerOpen = false; remote.pairingSheetOpen = true })
                    .ignoresSafeArea()
            } else {
                VStack(spacing: 16) {
                    Text("Camera scan unavailable").font(.system(.title3, design: .serif))
                    Text("Paste the cmdSpace pairing payload instead.").foregroundStyle(.secondary)
                    Button("Continue") { scannerOpen = false; remote.pairingSheetOpen = true }.buttonStyle(CmdSpaceButtonStyle())
                }.padding().background(CmdSpaceTheme.canvas.ignoresSafeArea())
            }
        }
    }
}

private struct ConnectingView: View {
    var body: some View {
        VStack(spacing: 16) { ProgressView(); Text("Connecting to your cmdSpace desktop…").font(.system(.body, design: .monospaced)) }
    }
}

private struct TerminalRemoteView: View {
    @EnvironmentObject private var remote: RemoteStore
    @State private var command = ""
    @State private var drawerOpen = false

    var body: some View {
        ZStack(alignment: .leading) {
            VStack(spacing: 0) {
                HStack { Button { drawerOpen = true } label: { Image(systemName: "line.3.horizontal") }; Spacer(); Circle().fill(CmdSpaceTheme.signal).frame(width: 7, height: 7); Text("CMDSPACE").font(.system(size: 11, design: .monospaced)); Spacer(); Image(systemName: "cube") }.padding()
                Divider()
                ScrollView { Text(remote.terminalText.isEmpty ? "Select a terminal from Workspaces." : remote.terminalText).font(.system(size: 13, design: .monospaced)).frame(maxWidth: .infinity, alignment: .leading).padding() }
                Divider()
                HStack { Text(">_").foregroundStyle(CmdSpaceTheme.signal); TextField("Command", text: $command).font(.system(.body, design: .monospaced)).onSubmit { remote.sendInput(command + "\r"); command = "" } }.padding(12)
            }
            if drawerOpen { WorkspaceDrawer(close: { drawerOpen = false }) }
        }
    }
}

private struct WorkspaceDrawer: View {
    @EnvironmentObject private var remote: RemoteStore
    let close: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { CmdSpaceLogo(size: 22); Text("Workspaces").font(.system(.headline, design: .monospaced)); Spacer(); Button(action: close) { Image(systemName: "xmark") } }
            ForEach(remote.sessions) { session in Button { remote.attach(session); close() } label: { VStack(alignment: .leading, spacing: 4) { Text(session.title).font(.system(.body, design: .monospaced)); Text(session.cwd ?? "Remote terminal").font(.system(.caption2, design: .monospaced)).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading).padding(12).background(CmdSpaceTheme.panel).clipShape(RoundedRectangle(cornerRadius: 10)) }.buttonStyle(.plain) }
            Spacer()
            Button("Disconnect") { remote.disconnect() }.buttonStyle(CmdSpaceButtonStyle())
        }.padding().frame(maxWidth: 330).frame(maxHeight: .infinity).background(CmdSpaceTheme.canvas).shadow(radius: 20)
    }
}

private enum CmdSpaceTheme { static let canvas = Color(red: 0.055, green: 0.047, blue: 0.05); static let panel = Color(red: 0.095, green: 0.085, blue: 0.09); static let signal = Color(red: 0.57, green: 0.78, blue: 0.45) }
private struct CmdSpaceLogo: View { let size: CGFloat; var body: some View { Group { if let image = UIImage(named: "logo.png") { Image(uiImage: image).resizable().scaledToFit().colorInvert() } }.frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: size * 0.26)) } }
private struct CmdSpaceSettingsView: View { let close: () -> Void; var body: some View { NavigationStack { VStack(alignment: .leading, spacing: 16) { Text("Settings").font(.system(.title2, design: .serif)); Text("Device identity is stored only in this iPhone's Keychain.").font(.system(.footnote, design: .monospaced)).foregroundStyle(.secondary); Spacer(); Link(destination: URL(string: "https://github.com/codeoneveryday-labs/cmdSpace")!) { Label("View cmdSpace on GitHub", systemImage: "chevron.left.forwardslash.chevron.right") }; Spacer() }.padding().background(CmdSpaceTheme.canvas.ignoresSafeArea()).toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done", action: close) } } }.preferredColorScheme(.dark) } }
private struct CmdSpaceButtonStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label.font(.system(.body, design: .monospaced)).frame(maxWidth: .infinity).padding(13).background(CmdSpaceTheme.panel.opacity(configuration.isPressed ? 0.6 : 1)).overlay(RoundedRectangle(cornerRadius: 10).stroke(.gray.opacity(0.45))).clipShape(RoundedRectangle(cornerRadius: 10)) } }
