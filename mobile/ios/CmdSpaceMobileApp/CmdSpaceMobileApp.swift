import SwiftUI
import CmdSpaceMobileCore

@main
struct CmdSpaceMobileApp: App {
    @StateObject private var remote = RemoteStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(remote)
                .preferredColorScheme(.dark)
        }
    }
}
