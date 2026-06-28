use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub link_target: Option<String>,
    pub size: u64,
    pub modified: Option<u64>, // Unix timestamp in seconds
    pub created: Option<u64>,  // Unix timestamp in seconds
    pub accessed: Option<u64>, // Unix timestamp in seconds
    pub extension: Option<String>,
}

pub fn expand_tilde(path: &str) -> String {
    expand_tilde_with_home(path, std::env::var("HOME").ok().as_deref())
}

fn expand_tilde_with_home(path: &str, home: Option<&str>) -> String {
    if path == "~" {
        return home
            .map(|h| h.to_string())
            .unwrap_or_else(|| path.to_string());
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(h) = home {
            return format!("{}/{}", h, rest);
        }
    }
    path.to_string()
}

fn system_time_to_unix(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn list_dir(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let path = expand_tilde(&path);
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
            let link_target = if is_symlink {
                std::fs::read_link(&entry_path)
                    .ok()
                    .map(|t| t.to_string_lossy().to_string())
            } else {
                None
            };
            let is_dir = metadata.is_dir() || (is_symlink && entry_path.is_dir());
            let size = if metadata.is_file() {
                metadata.len()
            } else {
                0
            };
            let modified = metadata.modified().ok().map(system_time_to_unix);
            let created = metadata.created().ok().map(system_time_to_unix);
            let accessed = metadata.accessed().ok().map(system_time_to_unix);
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
                link_target,
                size,
                modified,
                created,
                accessed,
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

/// Return directory candidates for path completion.
/// `partial` is the partial path the user has typed (already tilde-expanded by the caller).
/// Returns up to 20 full paths ending with `/`, sorted alphabetically.
#[tauri::command]
pub fn list_dir_completions(partial: String) -> Vec<String> {
    let partial = expand_tilde(&partial);

    // Split on the last `/` to get the parent dir and the typed prefix.
    let slash_idx = partial.rfind('/');
    let (parent_str, prefix) = match slash_idx {
        Some(i) => (&partial[..=i], &partial[i + 1..]),
        None => return vec![],
    };

    let parent = Path::new(parent_str);
    if !parent.is_dir() {
        return vec![];
    }

    let prefix_lower = prefix.to_lowercase();
    let show_hidden = prefix_lower.starts_with('.');

    let mut results: Vec<String> = std::fs::read_dir(parent)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            let is_hidden = name_str.starts_with('.');
            let matches = name_str.to_lowercase().starts_with(&prefix_lower);
            let is_dir = e.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
            is_dir && matches && (!is_hidden || show_hidden)
        })
        .map(|e| format!("{}{}/", parent_str, e.file_name().to_string_lossy()))
        .collect();

    results.sort();
    results.truncate(20);
    results
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
    let stem = base
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = base
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
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
            if dest_path.join(&name).exists() {
                Some(name)
            } else {
                None
            }
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
                    let target = if my_drive.exists() {
                        my_drive
                    } else {
                        entry.path()
                    };
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
    if truncated {
        buf.truncate(max_bytes);
    }
    match String::from_utf8(buf) {
        Ok(mut s) => {
            if truncated {
                s.push_str("\n\n[...省略...]");
            }
            Ok(s)
        }
        Err(_) => Err("binary".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── expand_tilde ─────────────────────────────────────────────────────────

    #[test]
    fn expand_tilde_plain_path_unchanged() {
        assert_eq!(
            expand_tilde_with_home("/usr/local/bin", Some("/home/user")),
            "/usr/local/bin"
        );
    }

    #[test]
    fn expand_tilde_alone_expands_to_home() {
        assert_eq!(
            expand_tilde_with_home("~", Some("/home/user")),
            "/home/user"
        );
    }

    #[test]
    fn expand_tilde_prefix_expands() {
        assert_eq!(
            expand_tilde_with_home("~/docs", Some("/home/user")),
            "/home/user/docs"
        );
    }

    #[test]
    fn expand_tilde_alone_no_home_returns_tilde() {
        assert_eq!(expand_tilde_with_home("~", None), "~");
    }

    #[test]
    fn expand_tilde_prefix_no_home_unchanged() {
        assert_eq!(expand_tilde_with_home("~/docs", None), "~/docs");
    }

    // ── unique_dest ──────────────────────────────────────────────────────────

    #[test]
    fn unique_dest_no_conflict_returns_base() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("file.txt");
        assert_eq!(unique_dest(&path), path);
    }

    #[test]
    fn unique_dest_one_conflict_appends_1() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("file.txt");
        fs::write(&path, b"").unwrap();
        assert_eq!(unique_dest(&path), dir.path().join("file_1.txt"));
    }

    #[test]
    fn unique_dest_multiple_conflicts_increments() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("file.txt");
        fs::write(&path, b"").unwrap();
        fs::write(dir.path().join("file_1.txt"), b"").unwrap();
        assert_eq!(unique_dest(&path), dir.path().join("file_2.txt"));
    }

    #[test]
    fn unique_dest_no_extension() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("readme");
        fs::write(&path, b"").unwrap();
        assert_eq!(unique_dest(&path), dir.path().join("readme_1"));
    }

    // ── check_copy_conflicts ─────────────────────────────────────────────────

    #[test]
    fn check_copy_conflicts_no_sources() {
        let dir = TempDir::new().unwrap();
        let conflicts = check_copy_conflicts(vec![], dir.path().to_string_lossy().to_string());
        assert!(conflicts.is_empty());
    }

    #[test]
    fn check_copy_conflicts_none_exist() {
        let src_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let src = src_dir.path().join("foo.txt");
        fs::write(&src, b"").unwrap();
        let conflicts = check_copy_conflicts(
            vec![src.to_string_lossy().to_string()],
            dest_dir.path().to_string_lossy().to_string(),
        );
        assert!(conflicts.is_empty());
    }

    #[test]
    fn check_copy_conflicts_detects_existing() {
        let src_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let src = src_dir.path().join("foo.txt");
        fs::write(&src, b"").unwrap();
        fs::write(dest_dir.path().join("foo.txt"), b"").unwrap();
        let conflicts = check_copy_conflicts(
            vec![src.to_string_lossy().to_string()],
            dest_dir.path().to_string_lossy().to_string(),
        );
        assert_eq!(conflicts, vec!["foo.txt"]);
    }

    // ── list_dir ─────────────────────────────────────────────────────────────

    #[test]
    fn list_dir_returns_entries() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), b"").unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        let entries = list_dir(dir.path().to_string_lossy().to_string(), true).unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn list_dir_dirs_sorted_first() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("z.txt"), b"").unwrap();
        fs::create_dir(dir.path().join("aaa")).unwrap();
        let entries = list_dir(dir.path().to_string_lossy().to_string(), true).unwrap();
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
    }

    #[test]
    fn list_dir_hides_dotfiles_by_default() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("visible.txt"), b"").unwrap();
        fs::write(dir.path().join(".hidden"), b"").unwrap();
        let entries = list_dir(dir.path().to_string_lossy().to_string(), false).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "visible.txt");
    }

    #[test]
    fn list_dir_shows_dotfiles_when_requested() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("visible.txt"), b"").unwrap();
        fs::write(dir.path().join(".hidden"), b"").unwrap();
        let entries = list_dir(dir.path().to_string_lossy().to_string(), true).unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn list_dir_nonexistent_returns_error() {
        let result = list_dir("/nonexistent/path/xyz".to_string(), false);
        assert!(result.is_err());
    }

    #[test]
    fn list_dir_file_path_returns_error() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, b"").unwrap();
        let result = list_dir(file.to_string_lossy().to_string(), false);
        assert!(result.is_err());
    }

    // ── create_file / create_dir ──────────────────────────────────────────────

    #[test]
    fn create_file_success() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("new.txt");
        assert!(create_file(path.to_string_lossy().to_string()).is_ok());
        assert!(path.exists());
    }

    #[test]
    fn create_file_already_exists_returns_error() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("existing.txt");
        fs::write(&path, b"").unwrap();
        assert!(create_file(path.to_string_lossy().to_string()).is_err());
    }

    #[test]
    fn create_dir_success() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("newdir");
        assert!(create_dir(path.to_string_lossy().to_string()).is_ok());
        assert!(path.is_dir());
    }

    #[test]
    fn create_dir_nested_creates_all() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a/b/c");
        assert!(create_dir(path.to_string_lossy().to_string()).is_ok());
        assert!(path.is_dir());
    }

    // ── rename_file ──────────────────────────────────────────────────────────

    #[test]
    fn rename_file_success() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("old.txt");
        let to = dir.path().join("new.txt");
        fs::write(&from, b"data").unwrap();
        assert!(rename_file(
            from.to_string_lossy().to_string(),
            to.to_string_lossy().to_string()
        )
        .is_ok());
        assert!(!from.exists());
        assert!(to.exists());
    }

    // ── copy_files ───────────────────────────────────────────────────────────

    #[test]
    fn copy_files_overwrite_strategy() {
        let src_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let src = src_dir.path().join("file.txt");
        fs::write(&src, b"new").unwrap();
        fs::write(dest_dir.path().join("file.txt"), b"old").unwrap();
        copy_files(
            vec![src.to_string_lossy().to_string()],
            dest_dir.path().to_string_lossy().to_string(),
            "overwrite".to_string(),
        )
        .unwrap();
        assert_eq!(fs::read(dest_dir.path().join("file.txt")).unwrap(), b"new");
    }

    #[test]
    fn copy_files_rename_strategy_avoids_conflict() {
        let src_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        let src = src_dir.path().join("file.txt");
        fs::write(&src, b"new").unwrap();
        fs::write(dest_dir.path().join("file.txt"), b"old").unwrap();
        copy_files(
            vec![src.to_string_lossy().to_string()],
            dest_dir.path().to_string_lossy().to_string(),
            "rename".to_string(),
        )
        .unwrap();
        assert!(dest_dir.path().join("file.txt").exists());
        assert!(dest_dir.path().join("file_1.txt").exists());
    }

    // ── read_text_file ───────────────────────────────────────────────────────

    #[test]
    fn read_text_file_success() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("text.txt");
        fs::write(&path, b"hello world").unwrap();
        let content = read_text_file(path.to_string_lossy().to_string(), 1024).unwrap();
        assert_eq!(content, "hello world");
    }

    #[test]
    fn read_text_file_binary_returns_error() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bin.bin");
        fs::write(&path, &[0xFF, 0xFE, 0x00, 0x01]).unwrap();
        let result = read_text_file(path.to_string_lossy().to_string(), 1024);
        assert_eq!(result.unwrap_err(), "binary");
    }

    #[test]
    fn read_text_file_truncated_appends_marker() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("long.txt");
        fs::write(&path, b"abcdefghij").unwrap();
        let content = read_text_file(path.to_string_lossy().to_string(), 5).unwrap();
        assert!(content.starts_with("abcde"));
        assert!(content.contains("[...省略...]"));
    }

    // ── list_dir_completions ─────────────────────────────────────────────────

    #[test]
    fn completions_returns_matching_dirs() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("alpha")).unwrap();
        fs::create_dir(dir.path().join("alpha2")).unwrap();
        fs::create_dir(dir.path().join("beta")).unwrap();
        fs::write(dir.path().join("alpha.txt"), b"").unwrap(); // file, should be excluded

        let partial = format!("{}/al", dir.path().to_string_lossy());
        let results = list_dir_completions(partial);
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.ends_with('/')));
        assert!(results.iter().any(|r| r.contains("alpha/")));
        assert!(results.iter().any(|r| r.contains("alpha2/")));
    }

    #[test]
    fn completions_trailing_slash_lists_all_dirs() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("foo")).unwrap();
        fs::create_dir(dir.path().join("bar")).unwrap();
        fs::write(dir.path().join("file.txt"), b"").unwrap();

        let partial = format!("{}/", dir.path().to_string_lossy());
        let results = list_dir_completions(partial);
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.ends_with('/')));
    }

    #[test]
    fn completions_hides_dotdirs_by_default() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".hidden")).unwrap();
        fs::create_dir(dir.path().join("visible")).unwrap();

        let partial = format!("{}/", dir.path().to_string_lossy());
        let results = list_dir_completions(partial);
        assert_eq!(results.len(), 1);
        assert!(results[0].contains("visible/"));
    }

    #[test]
    fn completions_shows_dotdirs_when_prefix_starts_with_dot() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".hidden")).unwrap();
        fs::create_dir(dir.path().join("visible")).unwrap();

        let partial = format!("{}/.hid", dir.path().to_string_lossy());
        let results = list_dir_completions(partial);
        assert_eq!(results.len(), 1);
        assert!(results[0].contains(".hidden/"));
    }

    #[test]
    fn completions_returns_empty_for_nonexistent_parent() {
        let results = list_dir_completions("/nonexistent_path_xyz/foo".to_string());
        assert!(results.is_empty());
    }

    #[test]
    fn completions_sorted_alphabetically() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("zoo")).unwrap();
        fs::create_dir(dir.path().join("aaa")).unwrap();
        fs::create_dir(dir.path().join("mmm")).unwrap();

        let partial = format!("{}/", dir.path().to_string_lossy());
        let results = list_dir_completions(partial);
        assert_eq!(
            results[0]
                .split('/')
                .filter(|s| !s.is_empty())
                .last()
                .unwrap(),
            "aaa"
        );
        assert_eq!(
            results[2]
                .split('/')
                .filter(|s| !s.is_empty())
                .last()
                .unwrap(),
            "zoo"
        );
    }
}
