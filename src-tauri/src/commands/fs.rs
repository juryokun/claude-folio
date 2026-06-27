use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<u64>, // Unix timestamp in seconds
    pub extension: Option<String>,
}

fn system_time_to_unix(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn list_dir(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();

            if !show_hidden && name.starts_with('.') {
                return None;
            }

            let entry_path = entry.path();
            let metadata = entry.metadata().ok()?;
            let is_symlink = metadata.file_type().is_symlink();
            let is_dir = metadata.is_dir() || (is_symlink && entry_path.is_dir());
            let size = if metadata.is_file() { metadata.len() } else { 0 };
            let modified = metadata.modified().ok().map(system_time_to_unix);
            let extension = if is_dir {
                None
            } else {
                entry_path
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
            };

            Some(FileEntry {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                is_symlink,
                size,
                modified,
                extension,
            })
        })
        .collect();

    // Directories first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub fn rename_file(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// Build a non-conflicting destination path by appending `_N` (N = 1, 2, …)
/// before the extension when `base` already exists.
fn unique_dest(base: &Path) -> PathBuf {
    if !base.exists() {
        return base.to_path_buf();
    }
    let stem = base.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = base.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let parent = base.parent().unwrap_or(Path::new("."));
    let mut n = 1u32;
    loop {
        let candidate = parent.join(format!("{stem}_{n}{ext}"));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

/// Return names of items in `sources` that already exist in `dest`.
#[tauri::command]
pub fn check_copy_conflicts(sources: Vec<String>, dest: String) -> Vec<String> {
    let dest_path = PathBuf::from(&dest);
    sources
        .iter()
        .filter_map(|src| {
            let src_path = PathBuf::from(src);
            let name = src_path.file_name()?.to_string_lossy().to_string();
            if dest_path.join(&name).exists() { Some(name) } else { None }
        })
        .collect()
}

#[tauri::command]
pub fn copy_files(sources: Vec<String>, dest: String, strategy: String) -> Result<(), String> {
    let dest_path = PathBuf::from(&dest);
    let overwrite = strategy == "overwrite";
    for src in &sources {
        let src_path = PathBuf::from(src);
        let file_name = src_path
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", src))?;
        if src_path.is_dir() {
            let target = dest_path.join(file_name);
            copy_dir_recursive(&src_path, &target, overwrite)?;
        } else {
            let base = dest_path.join(file_name);
            let target = if overwrite { base } else { unique_dest(&base) };
            std::fs::copy(&src_path, &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path, overwrite: bool) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            copy_dir_recursive(&entry_path, &dest.join(entry.file_name()), overwrite)?;
        } else {
            let base = dest.join(entry.file_name());
            let target = if overwrite { base } else { unique_dest(&base) };
            std::fs::copy(&entry_path, &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn move_files(sources: Vec<String>, dest: String) -> Result<(), String> {
    let dest_path = PathBuf::from(&dest);
    for src in &sources {
        let src_path = PathBuf::from(src);
        let file_name = src_path
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", src))?;
        let target = dest_path.join(file_name);
        // Try rename first (same volume), fall back to copy+delete
        if std::fs::rename(&src_path, &target).is_err() {
            if src_path.is_dir() {
                copy_dir_recursive(&src_path, &target, true)?;
                std::fs::remove_dir_all(&src_path).map_err(|e| e.to_string())?;
            } else {
                std::fs::copy(&src_path, &target).map_err(|e| e.to_string())?;
                std::fs::remove_file(&src_path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_google_drive() -> Vec<String> {
    let mut paths = Vec::new();

    if let Some(home) = dirs_home() {
        // Modern: ~/Library/CloudStorage/GoogleDrive-*/My Drive
        let cloud_storage = home.join("Library/CloudStorage");
        if let Ok(entries) = std::fs::read_dir(&cloud_storage) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("GoogleDrive-") {
                    let my_drive = entry.path().join("My Drive");
                    let target = if my_drive.exists() { my_drive } else { entry.path() };
                    // Resolve symlinks to get canonical path before deduplicating
                    let canonical = std::fs::canonicalize(&target).unwrap_or(target);
                    paths.push(canonical.to_string_lossy().to_string());
                }
            }
        }

        // Legacy: ~/Google Drive — only add if its canonical path isn't already listed
        let legacy = home.join("Google Drive");
        if legacy.exists() {
            let canonical = std::fs::canonicalize(&legacy).unwrap_or(legacy);
            let s = canonical.to_string_lossy().to_string();
            if !paths.contains(&s) {
                paths.push(s);
            }
        }
    }

    paths
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

/// Read the first `max_bytes` of a text file. Returns an error if the file
/// cannot be read as UTF-8 or if it exceeds the byte limit check indication.
#[tauri::command]
pub fn read_text_file(path: String, max_bytes: usize) -> Result<String, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; max_bytes + 1];
    let n = file.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(n);
    let truncated = n > max_bytes;
    if truncated { buf.truncate(max_bytes); }
    match String::from_utf8(buf) {
        Ok(mut s) => {
            if truncated { s.push_str("\n\n[...省略...]"); }
            Ok(s)
        }
        Err(_) => Err("binary".to_string()),
    }
}
