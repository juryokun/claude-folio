use std::path::PathBuf;

/// Returns the directory argument passed at startup (e.g. `open -a "Claude Folio" --args /some/dir`).
/// Returns None if no valid directory was given.
#[tauri::command]
pub fn get_startup_path() -> Option<String> {
    // args: [binary, path_arg]
    // When launched via `open --args`, macOS may inject extra args like `-psn_*`; skip those.
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .and_then(|p| {
            let expanded = if p == "~" {
                std::env::var("HOME").unwrap_or(p)
            } else if let Some(rest) = p.strip_prefix("~/") {
                format!("{}/{}", std::env::var("HOME").unwrap_or_default(), rest)
            } else {
                p
            };
            let path = PathBuf::from(&expanded);
            if path.is_dir() {
                Some(expanded)
            } else {
                None
            }
        })
}

const SCRIPT_CONTENT: &str = r#"#!/bin/bash
# folio — open Claude Folio in the given directory (defaults to current dir)
DIR="${1:-$(pwd)}"
DIR="$(cd "$DIR" && pwd)"
SOCK="/tmp/folio-$(id -u).sock"
if [ -S "$SOCK" ] && printf '%s' "$DIR" | nc -U -w1 "$SOCK" 2>/dev/null; then
  : # sent to running instance
else
  open -a "Claude Folio" --args "$DIR"
fi
"#;

/// Install the `folio` CLI shim.
/// The script is written to <AppBundle>/Contents/Resources/folio and
/// /usr/local/bin/folio is created as a symlink pointing to it.
#[tauri::command]
pub fn install_cli() -> Result<(), String> {
    // Resolve <AppBundle>/Contents/Resources from the running binary path.
    // current_exe() → .../Claude Folio.app/Contents/MacOS/folio
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let resources = exe
        .parent() // MacOS/
        .and_then(|p| p.parent()) // Contents/
        .map(|p| p.join("Resources"))
        .ok_or("Could not resolve app bundle path")?;

    let lib_path = resources.join("folio");
    let lib_str = lib_path.to_string_lossy().into_owned();
    let link_path = "/usr/local/bin/folio";

    // Write script into the bundle (no admin needed — app owns its own bundle)
    use std::os::unix::fs::PermissionsExt;
    std::fs::create_dir_all(&resources).map_err(|e| e.to_string())?;
    std::fs::write(&lib_path, SCRIPT_CONTENT).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&lib_path, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| e.to_string())?;

    // Create symlink at /usr/local/bin/folio — may need admin
    if try_symlink(&lib_str, link_path).is_ok() {
        return Ok(());
    }

    let shell_cmd = format!(
        "mkdir -p /usr/local/bin && ln -sf '{lib}' '{link}'",
        lib = lib_str,
        link = link_path,
    );
    let script = format!(
        "do shell script \"{}\" with administrator privileges",
        shell_cmd.replace('"', "\\\"")
    );

    let status = std::process::Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|e| e.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Installation cancelled or failed".to_string())
    }
}

fn try_symlink(target: &str, link_path: &str) -> Result<(), std::io::Error> {
    std::fs::create_dir_all("/usr/local/bin")?;
    let _ = std::fs::remove_file(link_path);
    std::os::unix::fs::symlink(target, link_path)?;
    Ok(())
}
