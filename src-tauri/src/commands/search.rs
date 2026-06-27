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
