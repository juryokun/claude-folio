use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecentEntry {
    pub path: String,
    pub kind: String,
    pub accessed_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<u64>,
}

fn recent_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        std::path::PathBuf::from(h)
            .join(".config")
            .join("folio")
            .join("history.json")
    })
}

fn read_mtime(path: &str) -> Option<u64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

pub(crate) fn load_recent_from(path: &std::path::Path) -> Vec<RecentEntry> {
    let Ok(content) = std::fs::read_to_string(path) else {
        return vec![];
    };
    serde_json::from_str::<Vec<RecentEntry>>(&content).unwrap_or_else(|e| {
        eprintln!("[folio] recent history parse error: {e}");
        vec![]
    })
}

pub(crate) fn push_entry_to(
    path: &std::path::Path,
    entry: RecentEntry,
    max: usize,
) -> Result<(), String> {
    let mut entries = load_recent_from(path);
    entries.retain(|e| e.path != entry.path);
    entries.insert(0, entry);
    entries.truncate(max);
    save_recent_to(path, entries)
}

pub(crate) fn save_recent_to(
    path: &std::path::Path,
    entries: Vec<RecentEntry>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_recent_entries() -> Vec<RecentEntry> {
    let Some(path) = recent_path() else {
        return vec![];
    };
    let mut entries = load_recent_from(&path);
    for entry in &mut entries {
        entry.modified = read_mtime(&entry.path);
    }
    entries
}

#[tauri::command]
pub fn push_recent_entry(path: String, kind: String) -> Result<(), String> {
    if kind != "file" && kind != "dir" {
        return Err(format!("invalid kind: {kind}"));
    }
    let Some(history_path) = recent_path() else {
        return Err("could not determine config path".to_string());
    };
    let modified = read_mtime(&path);
    let entry = RecentEntry {
        accessed_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        path,
        kind,
        modified,
    };
    push_entry_to(&history_path, entry, 500)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn entry(path: &str, kind: &str) -> RecentEntry {
        RecentEntry {
            path: path.to_string(),
            kind: kind.to_string(),
            accessed_at: 1000,
            modified: None,
        }
    }

    #[test]
    fn load_recent_from_nonexistent_returns_empty() {
        let dir = TempDir::new().unwrap();
        let result = load_recent_from(&dir.path().join("nope.json"));
        assert!(result.is_empty());
    }

    #[test]
    fn push_entry_to_creates_file_with_first_entry() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("history.json");
        push_entry_to(&path, entry("/foo/bar.txt", "file"), 500).unwrap();
        let entries = load_recent_from(&path);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "/foo/bar.txt");
        assert_eq!(entries[0].kind, "file");
    }

    #[test]
    fn push_entry_to_deduplicates_same_path_and_moves_to_front() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("history.json");
        push_entry_to(&path, entry("/a", "file"), 500).unwrap();
        push_entry_to(&path, entry("/b", "file"), 500).unwrap();
        push_entry_to(&path, entry("/a", "file"), 500).unwrap();
        let entries = load_recent_from(&path);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "/a");
        assert_eq!(entries[1].path, "/b");
    }

    #[test]
    fn push_entry_to_trims_to_max_entries() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("history.json");
        for i in 0..5u32 {
            push_entry_to(&path, entry(&format!("/path/{i}"), "file"), 3).unwrap();
        }
        let entries = load_recent_from(&path);
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn load_and_push_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("history.json");
        let e1 = entry("/home/user/doc.txt", "file");
        let e2 = entry("/home/user/projects", "dir");
        push_entry_to(&path, e1.clone(), 500).unwrap();
        push_entry_to(&path, e2.clone(), 500).unwrap();
        let entries = load_recent_from(&path);
        assert_eq!(entries[0].path, e2.path);
        assert_eq!(entries[1].path, e1.path);
    }

    #[test]
    fn modified_is_none_for_nonexistent_path() {
        let entry_obj = RecentEntry {
            path: "/nonexistent/path/file.txt".to_string(),
            kind: "file".to_string(),
            accessed_at: 1000,
            modified: read_mtime("/nonexistent/path/file.txt"),
        };
        assert!(entry_obj.modified.is_none());
    }

    #[test]
    fn modified_is_some_for_existing_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.txt");
        std::fs::write(&file, b"hello").unwrap();
        let mtime = read_mtime(file.to_str().unwrap());
        assert!(mtime.is_some());
    }
}
