/// Open a file with Quick Look (macOS `qlmanage -p`).
#[tauri::command]
pub fn quick_look(path: String) -> Result<(), String> {
    std::process::Command::new("qlmanage")
        .arg("-p")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

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
        "/opt/homebrew/bin", // Apple Silicon Homebrew
        "/usr/local/bin",    // Intel Homebrew / manual installs
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

/// Run a shell command string via `/bin/zsh -l -c` with an optional working directory.
fn spawn_via_zsh(shell_cmd: &str, cwd: Option<&std::path::Path>) -> Result<(), String> {
    let mut cmd = std::process::Command::new("/bin/zsh");
    cmd.args(["-l", "-c", shell_cmd]);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Expand `{}` placeholder in a command template with the given file path.
/// If `{}` is not present and a file path is provided, append it at the end.
fn expand_placeholder(cmd: &str, file_path: Option<&str>) -> String {
    match file_path {
        None => cmd.to_string(),
        Some(p) => {
            if cmd.contains("{}") {
                cmd.replace("{}", p)
            } else {
                format!("{} {}", cmd, p)
            }
        }
    }
}

/// Spawn a command, resolving the binary through common macOS paths first.
/// Falls back to zsh login shell if the binary is not found in known locations.
/// `{}` in the command is replaced with `file_path`; if absent, path is appended.
/// `cwd` sets the working directory of the spawned process.
fn spawn_command(
    cmd: &str,
    file_path: Option<&str>,
    cwd: Option<&std::path::Path>,
) -> Result<(), String> {
    let expanded = expand_placeholder(cmd, file_path);
    let mut parts = expanded.split_whitespace();
    let binary = parts.next().ok_or("command is empty")?;
    let binary_path = resolve_binary(binary);

    if binary_path == binary {
        // Binary not found in known paths — delegate to zsh
        return spawn_via_zsh(&expanded, cwd);
    }

    let mut command = std::process::Command::new(&binary_path);
    command.args(parts);
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    command
        .spawn()
        .map_err(|e| format!("{}: {}", binary_path, e))?;
    Ok(())
}

/// List installed .app bundles from /Applications and ~/Applications.
#[tauri::command]
pub fn list_applications() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let dirs = [
        "/Applications".to_string(),
        format!("{}/Applications", home),
    ];
    let mut apps: Vec<String> = Vec::new();
    for dir in &dirs {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".app") {
                apps.push(name.trim_end_matches(".app").to_string());
            }
        }
    }
    apps.sort_by_key(|a| a.to_lowercase());
    apps.dedup();
    apps
}

/// Open a file with a user-specified macOS app (open -a <app> <file>).
#[tauri::command]
pub fn open_with_app(path: String, app: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-a", &app, &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Open a file with a specific editor command.
/// `{}` in editor_cmd is replaced with the file path; otherwise path is appended.
/// Working directory is set to the file's parent so relative output paths work.
#[tauri::command]
pub fn open_with_editor(path: String, editor_cmd: String) -> Result<(), String> {
    if editor_cmd.is_empty() {
        return Err("editor command is empty".to_string());
    }
    let cwd = std::path::Path::new(&path).parent();
    spawn_command(&editor_cmd, Some(&path), cwd)
}

/// Open a terminal at the given path.
/// If `command` is non-empty, spawns it directly with `<path>` appended.
/// Otherwise uses `open -a <app> <path>` with `app` defaulting to "Terminal".
#[tauri::command]
pub fn open_terminal_at(path: String, app: String, command: String) -> Result<(), String> {
    if !command.is_empty() {
        let cwd = std::path::Path::new(&path);
        spawn_command(&command, Some(&path), Some(cwd))
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
