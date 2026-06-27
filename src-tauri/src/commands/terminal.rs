/// Open a file with the default application (macOS `open` command).
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Resolve a bare binary name to its full path by searching common macOS locations.
/// Falls back to the original name if not found (lets the OS try its own PATH).
fn resolve_binary(name: &str) -> String {
    // Skip resolution if already an absolute path
    if name.starts_with('/') {
        return name.to_string();
    }
    // Check flat directories first
    let dirs = [
        "/opt/homebrew/bin",   // Apple Silicon Homebrew
        "/usr/local/bin",      // Intel Homebrew / manual installs
        "/usr/bin",
        "/bin",
    ];
    for dir in &dirs {
        let full = format!("{}/{}", dir, name);
        if std::path::Path::new(&full).exists() {
            return full;
        }
    }
    // Check .app bundles in /Applications — e.g. "alacritty" → /Applications/Alacritty.app/Contents/MacOS/alacritty
    let capitalized = {
        let mut c = name.chars();
        match c.next() {
            Some(first) => first.to_uppercase().to_string() + c.as_str(),
            None => name.to_string(),
        }
    };
    let app_bundle = format!("/Applications/{}.app/Contents/MacOS/{}", capitalized, name);
    if std::path::Path::new(&app_bundle).exists() {
        return app_bundle;
    }
    name.to_string()
}

/// Spawn a command, resolving the binary through common Homebrew paths.
fn spawn_command(cmd: &str, extra_arg: Option<&str>) -> Result<(), String> {
    let mut parts = cmd.split_whitespace();
    let binary = parts.next().ok_or("command is empty")?;
    let binary_path = resolve_binary(binary);
    let mut command = std::process::Command::new(&binary_path);
    command.args(parts);
    if let Some(arg) = extra_arg {
        command.arg(arg);
    }
    command.spawn().map_err(|e| format!("{}: {}", binary_path, e))?;
    Ok(())
}

/// Open a file with a specific editor command.
#[tauri::command]
pub fn open_with_editor(path: String, editor_cmd: String) -> Result<(), String> {
    if editor_cmd.is_empty() {
        return Err("editor command is empty".to_string());
    }
    spawn_command(&editor_cmd, Some(&path))
}

/// Open a terminal at the given path.
/// If `command` is non-empty, spawns it directly with `<path>` appended.
/// Otherwise uses `open -a <app> <path>` with `app` defaulting to "Terminal".
#[tauri::command]
pub fn open_terminal_at(path: String, app: String, command: String) -> Result<(), String> {
    if !command.is_empty() {
        spawn_command(&command, Some(&path))
    } else {
        let app_name = if app.is_empty() { "Terminal" } else { &app };
        std::process::Command::new("open")
            .args(["-a", app_name, &path])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
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
