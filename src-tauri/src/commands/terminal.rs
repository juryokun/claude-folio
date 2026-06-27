#[tauri::command]
pub fn open_terminal_at(path: String, emulator: String) -> Result<(), String> {
    let app_name = match emulator.as_str() {
        "iterm2" => "iTerm",
        "warp" => "Warp",
        _ => "Terminal",
    };

    std::process::Command::new("open")
        .args(["-a", app_name, &path])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn check_zoxide_installed() -> bool {
    std::process::Command::new("which")
        .arg("zoxide")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn zoxide_query(query: String) -> Result<Vec<String>, String> {
    let output = std::process::Command::new("zoxide")
        .args(["query", "--list", &query])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

#[tauri::command]
pub fn zoxide_add(path: String) -> Result<(), String> {
    std::process::Command::new("zoxide")
        .args(["add", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
