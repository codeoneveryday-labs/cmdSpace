import SwiftUI
import CmdSpaceMobileCore

@main
struct CmdSpaceMobileApp: App {
    @StateObject private var remote = RemoteStore()
    @AppStorage(AppearancePreference.storageKey) private var appearanceRawValue = AppearancePreference.system.rawValue

    private var appearance: AppearancePreference {
        AppearancePreference(rawValue: appearanceRawValue) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(remote)
                .preferredColorScheme(appearance.colorScheme)
        }
    }
}
