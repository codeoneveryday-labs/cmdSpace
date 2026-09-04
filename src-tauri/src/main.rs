// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// `tauri dev` runs the debug executable directly instead of inside a `.app`
// bundle. Embed the permission declarations so macOS can authorize native
// Speech and microphone access during development too.
#[cfg(all(debug_assertions, target_os = "macos"))]
embed_plist::embed_info_plist!("../Info.plist");

fn main() {
    cmdspace_lib::run()
}
