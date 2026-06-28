use walkdir::WalkDir;
use crate::commands::fs::FileEntry;
use std::time::SystemTime;

fn system_time_to_unix(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn search_files(
    root: String,
    query: String,
    max_results: usize,
) -> Result<Vec<FileEntry>, String> {
    let query_lower = query.to_lowercase();
    let results: Vec<FileEntry> = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.contains(&query_lower)
        })
        .take(max_results)
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            let meta = e.metadata().ok()?;
            let is_symlink = meta.file_type().is_symlink();
            let is_dir = meta.is_dir();
            let size = if meta.is_file() { meta.len() } else { 0 };
            let modified = meta.modified().ok().map(system_time_to_unix);
            let extension = if is_dir {
                None
            } else {
                e.path()
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_lowercase())
            };

            Some(FileEntry {
                name,
                path,
                is_dir,
                is_symlink,
                link_target: None,
                size,
                modified,
                extension,
            })
        })
        .collect();

    Ok(results)
}

const SEVENZIP_CANDIDATES: &[&str] = &[
    "/opt/homebrew/bin/7z",
    "/usr/local/bin/7z",
    "/usr/bin/7z",
];

const FD_CANDIDATES: &[&str] = &[
    "/opt/homebrew/bin/fd",
    "/usr/local/bin/fd",
    "/usr/bin/fd",
];

fn find_fd() -> Option<&'static str> {
    FD_CANDIDATES.iter().copied().find(|p| std::path::Path::new(p).exists())
}

#[tauri::command]
pub fn check_fd_installed() -> bool {
    find_fd().is_some()
}

/// Run `fd` with the given pattern and type, returning up to `max_results` FileEntry items.
/// `fd_type`: "file" | "dir"
#[tauri::command]
pub fn search_with_fd(
    root: String,
    query: String,
    fd_type: String,
) -> Result<Vec<FileEntry>, String> {
    let fd = find_fd().ok_or("fd is not installed")?;

    let mut args: Vec<&str> = vec!["--max-results", "500", "--color", "never"];
    match fd_type.as_str() {
        "file" => { args.extend_from_slice(&["--type", "f"]); }
        "dir"  => { args.extend_from_slice(&["--type", "d"]); }
        _      => {} // "all": no --type filter
    }
    args.extend_from_slice(&["--", &query, &root]);

    let output = std::process::Command::new(fd)
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<FileEntry> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|path_str| {
            let path = std::path::Path::new(path_str);
            let meta = path.metadata().ok()?;
            let name = path.file_name()?.to_string_lossy().to_string();
            let is_symlink = path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false);
            let link_target = if is_symlink {
                std::fs::read_link(path).ok().map(|t| t.to_string_lossy().to_string())
            } else {
                None
            };
            let extension = if meta.is_dir() {
                None
            } else {
                path.extension().map(|e| e.to_string_lossy().to_string())
            };
            Some(FileEntry {
                name,
                path: path_str.to_string(),
                is_dir: meta.is_dir(),
                size: if meta.is_file() { meta.len() } else { 0 },
                modified: meta.modified().ok().map(|t| {
                    t.duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
                }),
                is_symlink,
                link_target,
                extension,
            })
        })
        .collect();

    // dirs first, then alphabetical
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir { return if a.is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater }; }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(entries)
}

fn find_7zip() -> Option<&'static str> {
    SEVENZIP_CANDIDATES.iter().copied().find(|p| std::path::Path::new(p).exists())
}

#[tauri::command]
pub fn check_7zip_installed() -> bool {
    find_7zip().is_some()
}

#[tauri::command]
pub fn compress_7zip(
    paths: Vec<String>,
    dest: String,
    windows_compat: bool,
) -> Result<(), String> {
    let bin = find_7zip().ok_or("7z が見つかりません")?;
    let mut args = vec!["a".to_string()];
    if windows_compat {
        // -tzip: zip format for cross-platform compatibility
        // -mcp=UTF-8 is Windows-only and causes E_INVALIDARG on macOS — omit it
        args.push("-tzip".to_string());
    }
    args.push(dest.clone());
    args.extend(paths);

    let output = std::process::Command::new(bin)
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn extract_7zip(archive: String, dest: String) -> Result<(), String> {
    let bin = find_7zip().ok_or("7z が見つかりません")?;
    let output = std::process::Command::new(bin)
        .args(["x", &archive, &format!("-o{}", dest), "-y"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}
