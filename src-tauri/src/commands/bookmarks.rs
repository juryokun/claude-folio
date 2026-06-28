use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BookmarkEntry {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct BookmarksFile {
    #[serde(default)]
    pub bookmarks: Vec<BookmarkEntry>,
}

fn bookmarks_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        std::path::PathBuf::from(h)
            .join(".config")
            .join("folio")
            .join("bookmarks.toml")
    })
}

pub(crate) fn load_bookmarks_from(path: &std::path::Path) -> Vec<BookmarkEntry> {
    let Ok(content) = std::fs::read_to_string(path) else {
        return vec![];
    };
    toml::from_str::<BookmarksFile>(&content)
        .unwrap_or_else(|e| {
            eprintln!("[folio] bookmarks parse error: {e}");
            BookmarksFile::default()
        })
        .bookmarks
}

pub(crate) fn save_bookmarks_to(
    path: &std::path::Path,
    bookmarks: Vec<BookmarkEntry>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let file = BookmarksFile { bookmarks };
    let content = toml::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_bookmarks() -> Vec<BookmarkEntry> {
    let Some(path) = bookmarks_path() else {
        return vec![];
    };
    load_bookmarks_from(&path)
}

#[tauri::command]
pub fn save_bookmarks(bookmarks: Vec<BookmarkEntry>) -> Result<(), String> {
    let Some(path) = bookmarks_path() else {
        return Err("could not determine config path".to_string());
    };
    save_bookmarks_to(&path, bookmarks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn entry(label: &str, path: &str) -> BookmarkEntry {
        BookmarkEntry {
            label: label.to_string(),
            path: path.to_string(),
        }
    }

    #[test]
    fn load_bookmarks_from_nonexistent_returns_empty() {
        let dir = TempDir::new().unwrap();
        let result = load_bookmarks_from(&dir.path().join("nope.toml"));
        assert!(result.is_empty());
    }

    #[test]
    fn load_bookmarks_from_invalid_toml_returns_empty() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        std::fs::write(&path, "NOT VALID TOML :::").unwrap();
        assert!(load_bookmarks_from(&path).is_empty());
    }

    #[test]
    fn load_bookmarks_from_valid_toml() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        std::fs::write(
            &path,
            r#"
[[bookmarks]]
label = "Projects"
path = "/Users/user/Projects"
"#,
        )
        .unwrap();
        let result = load_bookmarks_from(&path);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].label, "Projects");
        assert_eq!(result[0].path, "/Users/user/Projects");
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        let bookmarks = vec![
            entry("Home", "/Users/user"),
            entry("Work", "/Users/user/work"),
        ];
        save_bookmarks_to(&path, bookmarks.clone()).unwrap();
        let loaded = load_bookmarks_from(&path);
        assert_eq!(loaded, bookmarks);
    }

    #[test]
    fn save_bookmarks_to_creates_parent_dirs() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nested/dir/bookmarks.toml");
        save_bookmarks_to(&path, vec![]).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn save_bookmarks_to_overwrites_existing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        save_bookmarks_to(&path, vec![entry("Old", "/old")]).unwrap();
        save_bookmarks_to(&path, vec![entry("New", "/new")]).unwrap();
        let loaded = load_bookmarks_from(&path);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].label, "New");
    }
}
