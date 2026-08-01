fn main() {
    println!("cargo:rerun-if-changed=Info.plist");
    tauri_build::build()
}
