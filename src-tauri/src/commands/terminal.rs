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

/// Parse the output of `printf "_ZO_DATA_DIR=%s\nXDG_DATA_HOME=%s\n" ...`
/// run inside the user's login shell.
/// Returns only the non-empty variables relevant to zoxide's data directory.
pub(crate) fn parse_zoxide_shell_env(output: &str) -> std::collections::HashMap<String, String> {
    output
        .lines()
        .filter_map(|l| l.split_once('='))
        .filter(|(k, v)| matches!(*k, "_ZO_DATA_DIR" | "XDG_DATA_HOME") && !v.is_empty())
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

/// Get environment variables needed for zoxide to find the same database as the
/// user's login shell. Cached after first call.
///
/// macOS app bundles launched from the GUI do not inherit the login shell
/// environment, so variables such as `_ZO_DATA_DIR` and `XDG_DATA_HOME` that
/// the user sets in `~/.zshrc` / `config.fish` are absent. Without them,
/// zoxide falls back to `~/Library/Application Support/zoxide` which is a
/// different database from the one the shell's `z` function uses.
fn shell_env_for_zoxide() -> &'static std::collections::HashMap<String, String> {
    use std::sync::OnceLock;
    static ENV: OnceLock<std::collections::HashMap<String, String>> = OnceLock::new();
    ENV.get_or_init(|| {
        // 1. Current process already has _ZO_DATA_DIR (e.g. dev mode from terminal)
        if let Ok(v) = std::env::var("_ZO_DATA_DIR") {
            if !v.is_empty() {
                return [("_ZO_DATA_DIR".to_string(), v)].into();
            }
        }

        // 2. Ask the login shell for the two relevant variables (5-second timeout)
        if let Ok(shell) = std::env::var("SHELL") {
            let cmd =
                r#"printf "_ZO_DATA_DIR=%s\nXDG_DATA_HOME=%s\n" "$_ZO_DATA_DIR" "$XDG_DATA_HOME""#;
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let result = std::process::Command::new(&shell)
                    .args(["-l", "-c", cmd])
                    .output();
                let _ = tx.send(result);
            });
            if let Ok(Ok(out)) = rx.recv_timeout(std::time::Duration::from_secs(5)) {
                if out.status.success() {
                    let parsed = parse_zoxide_shell_env(&String::from_utf8_lossy(&out.stdout));
                    // Prefer _ZO_DATA_DIR; fall back to XDG_DATA_HOME
                    if let Some(v) = parsed.get("_ZO_DATA_DIR") {
                        return [("_ZO_DATA_DIR".to_string(), v.clone())].into();
                    }
                    if let Some(v) = parsed.get("XDG_DATA_HOME") {
                        return [("XDG_DATA_HOME".to_string(), v.clone())].into();
                    }
                }
            }
        }

        // 3. Fallback: check well-known paths for an existing zoxide database.
        // Check the macOS platform default first (most likely when neither
        // _ZO_DATA_DIR nor XDG_DATA_HOME is set), then the XDG convention path.
        let home = std::env::var("HOME").unwrap_or_default();
        for dir in [
            format!("{}/Library/Application Support/zoxide", home),
            format!("{}/.local/share/zoxide", home),
        ] {
            if std::path::Path::new(&dir).exists() {
                return [("_ZO_DATA_DIR".to_string(), dir)].into();
            }
        }

        std::collections::HashMap::new()
    })
}

fn zoxide_bin() -> Option<&'static std::path::Path> {
    use std::sync::OnceLock;
    static BIN: OnceLock<Option<std::path::PathBuf>> = OnceLock::new();
    BIN.get_or_init(|| {
        let candidates = [
            "/opt/homebrew/bin/zoxide",
            "/usr/local/bin/zoxide",
            "/usr/bin/zoxide",
        ];
        for path in candidates {
            let p = std::path::Path::new(path);
            if p.exists() {
                return Some(p.to_path_buf());
            }
        }
        // フォールバック: PATH 検索
        if std::process::Command::new("zoxide")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(std::path::PathBuf::from("zoxide"));
        }
        None
    })
    .as_deref()
}

#[tauri::command]
pub fn check_zoxide_installed() -> bool {
    zoxide_bin().is_some()
}

#[tauri::command]
pub fn zoxide_query(query: String) -> Result<Vec<String>, String> {
    let bin = zoxide_bin().ok_or_else(|| "zoxide not found".to_string())?;
    let output = std::process::Command::new(bin)
        .args(["query", "--list", &query])
        .envs(shell_env_for_zoxide())
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && std::path::Path::new(l).is_absolute())
        .collect())
}

#[tauri::command]
pub fn zoxide_add(path: String) -> Result<(), String> {
    let bin = zoxide_bin().ok_or_else(|| "zoxide not found".to_string())?;
    let output = std::process::Command::new(bin)
        .args(["add", &path])
        .envs(shell_env_for_zoxide())
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        eprintln!("zoxide add failed: {:?}", output.status);
    }
    Ok(())
}
