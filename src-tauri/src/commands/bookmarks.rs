use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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
            .join("mac-filer")
            .join("bookmarks.toml")
    })
}

#[tauri::command]
pub fn load_bookmarks() -> Vec<BookmarkEntry> {
    let Some(path) = bookmarks_path() else { return vec![] };
    let Ok(content) = std::fs::read_to_string(&path) else { return vec![] };
    toml::from_str::<BookmarksFile>(&content)
        .unwrap_or_else(|e| {
            eprintln!("[mac-filer] bookmarks parse error: {e}");
            BookmarksFile::default()
        })
        .bookmarks
}

#[tauri::command]
pub fn save_bookmarks(bookmarks: Vec<BookmarkEntry>) -> Result<(), String> {
    let Some(path) = bookmarks_path() else {
        return Err("could not determine config path".to_string());
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let file = BookmarksFile { bookmarks };
    let content = toml::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
