#[tauri::command]
pub fn suppress_ds_store() {
    let _ = std::process::Command::new("defaults")
        .args([
            "write",
            "com.apple.desktopservices",
            "DSDontWriteNetworkStores",
            "-bool",
            "true",
        ])
        .output();
}
