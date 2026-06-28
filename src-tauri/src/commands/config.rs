use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateColumnConfig {
    #[serde(default = "default_true")]
    pub show: bool,
    #[serde(default = "default_date_format")]
    pub format: String,
}

impl Default for DateColumnConfig {
    fn default() -> Self {
        Self { show: false, format: "auto".to_string() }
    }
}

fn default_date_modified() -> DateColumnConfig {
    DateColumnConfig { show: true, format: "auto".to_string() }
}
fn default_date_created() -> DateColumnConfig {
    DateColumnConfig { show: false, format: "auto".to_string() }
}
fn default_date_accessed() -> DateColumnConfig {
    DateColumnConfig { show: false, format: "auto".to_string() }
}
fn default_true() -> bool { true }
fn default_date_format() -> String { "auto".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    #[serde(default = "default_date_modified")]
    pub date_modified: DateColumnConfig,
    #[serde(default = "default_date_created")]
    pub date_created: DateColumnConfig,
    #[serde(default = "default_date_accessed")]
    pub date_accessed: DateColumnConfig,
    #[serde(default = "default_size_unit")]
    pub size_unit: String,
}

fn default_size_unit() -> String {
    "binary".to_string()
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            date_modified: default_date_modified(),
            date_created: default_date_created(),
            date_accessed: default_date_accessed(),
            size_unit: "binary".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EditorConfig {
    #[serde(default)]
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TerminalConfig {
    /// macOS app name passed to `open -a`. e.g. "Terminal", "iTerm", "Warp", "Ghostty"
    #[serde(default)]
    pub app: String,
    /// Direct command for terminals that don't support `open -a <dir>`.
    /// The working directory path is appended as the last argument.
    /// e.g. "alacritty --working-directory", "kitty --directory"
    #[serde(default)]
    pub command: String,
}

fn default_favorites() -> Vec<String> {
    vec![
        "home".to_string(),
        "desktop".to_string(),
        "documents".to_string(),
        "downloads".to_string(),
        "pictures".to_string(),
        "music".to_string(),
        "movies".to_string(),
        "applications".to_string(),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarConfig {
    #[serde(default = "default_favorites")]
    pub favorites: Vec<String>,
}

impl Default for SidebarConfig {
    fn default() -> Self {
        Self {
            favorites: default_favorites(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub editor: EditorConfig,
    #[serde(default)]
    pub terminal: TerminalConfig,
    /// action_name -> list of key sequences ("j", "d d", "s n" …)
    #[serde(default)]
    pub keymap: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub sidebar: SidebarConfig,
    /// UI display language: "ja" or "en"
    #[serde(default = "default_language")]
    pub language: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            appearance: AppearanceConfig::default(),
            editor: EditorConfig::default(),
            terminal: TerminalConfig::default(),
            keymap: HashMap::new(),
            sidebar: SidebarConfig::default(),
            language: default_language(),
        }
    }
}

fn default_language() -> String {
    "en".to_string()
}

fn config_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        std::path::PathBuf::from(h)
            .join(".config")
            .join("folio")
            .join("config.toml")
    })
}

pub(crate) fn load_config_from(path: &std::path::Path) -> AppConfig {
    let Ok(content) = std::fs::read_to_string(path) else {
        return AppConfig::default();
    };
    toml::from_str(&content).unwrap_or_else(|e| {
        eprintln!("[mac-filer] config parse error: {e}");
        AppConfig::default()
    })
}

#[tauri::command]
pub fn load_config() -> AppConfig {
    let Some(path) = config_path() else {
        return AppConfig::default();
    };
    load_config_from(&path)
}

/// Write a sample config to ~/.config/mac-filer/config.toml.
/// Returns Ok(path) on success, Err("exists") if the file already exists.
#[tauri::command]
pub fn init_config() -> Result<String, String> {
    let path = config_path().ok_or("HOME not set")?;
    if path.exists() {
        return Err("exists".to_string());
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, SAMPLE_CONFIG).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub(crate) fn save_language_to(path: &std::path::Path, language: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let base = if path.exists() {
        std::fs::read_to_string(path).map_err(|e| e.to_string())?
    } else {
        SAMPLE_CONFIG.to_string()
    };
    let updated = replace_language_line(&base, language);
    std::fs::write(path, updated).map_err(|e| e.to_string())
}

/// Persist only the language field to the config file.
/// If the file doesn't exist yet, initialises it from the template (preserving comments).
/// If it already exists, updates only the `language = "..."` line in-place.
#[tauri::command]
pub fn save_language(language: String) -> Result<(), String> {
    let path = config_path().ok_or("HOME not set")?;
    save_language_to(&path, &language)
}

/// Replace `language = "..."` in a TOML string; appends the line if not found.
fn replace_language_line(content: &str, lang: &str) -> String {
    let new_line = format!("language = \"{}\"", lang);
    let mut found = false;
    let mut lines: Vec<String> = content
        .lines()
        .map(|l| {
            if !found && l.trim_start().starts_with("language") && l.contains('=') {
                found = true;
                new_line.clone()
            } else {
                l.to_string()
            }
        })
        .collect();
    if !found {
        lines.push(new_line);
    }
    let mut out = lines.join("\n");
    if content.ends_with('\n') {
        out.push('\n');
    }
    out
}

const SAMPLE_CONFIG: &str = include_str!("../../assets/config.template.toml");

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ── replace_language_line ─────────────────────────────────────────────────

    #[test]
    fn replace_language_line_replaces_existing() {
        let input = "language = \"en\"\n";
        let result = replace_language_line(input, "ja");
        assert_eq!(result, "language = \"ja\"\n");
    }

    #[test]
    fn replace_language_line_appends_if_missing() {
        let input = "[appearance]\nsize_unit = \"binary\"\n";
        let result = replace_language_line(input, "ja");
        assert!(result.contains("language = \"ja\""));
        assert!(result.contains("[appearance]"));
    }

    #[test]
    fn replace_language_line_preserves_trailing_newline() {
        let with_newline = "language = \"en\"\n";
        let without_newline = "language = \"en\"";
        assert!(replace_language_line(with_newline, "ja").ends_with('\n'));
        assert!(!replace_language_line(without_newline, "ja").ends_with('\n'));
    }

    #[test]
    fn replace_language_line_preserves_comments() {
        let input = "# UI language\nlanguage = \"en\"\n";
        let result = replace_language_line(input, "ja");
        assert!(result.contains("# UI language"));
        assert!(result.contains("language = \"ja\""));
    }

    #[test]
    fn replace_language_line_ignores_commented_out_line() {
        // A line like "# language = ..." should NOT be treated as the language key
        let input = "# language = \"en\"\nlanguage = \"en\"\n";
        let result = replace_language_line(input, "ja");
        assert!(
            result.contains("# language = \"en\""),
            "comment should be preserved"
        );
        assert!(
            result.contains("language = \"ja\""),
            "real key should be updated"
        );
    }

    // ── load_config_from ─────────────────────────────────────────────────────

    #[test]
    fn load_config_from_nonexistent_returns_default() {
        let dir = TempDir::new().unwrap();
        let cfg = load_config_from(&dir.path().join("nonexistent.toml"));
        assert_eq!(cfg.language, "en");
    }

    #[test]
    fn load_config_from_valid_toml() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "language = \"ja\"\n").unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.language, "ja");
    }

    #[test]
    fn load_config_from_invalid_toml_returns_default() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "NOT VALID TOML :::").unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.language, "en");
    }

    // ── save_language_to ─────────────────────────────────────────────────────

    #[test]
    fn save_language_to_creates_file_from_template() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");
        assert!(!path.exists());
        save_language_to(&path, "ja").unwrap();
        assert!(path.exists());
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("language = \"ja\""));
    }

    #[test]
    fn save_language_to_updates_existing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "# my config\nlanguage = \"en\"\n").unwrap();
        save_language_to(&path, "ja").unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("language = \"ja\""));
        assert!(
            content.contains("# my config"),
            "comments should be preserved"
        );
    }

    #[test]
    fn save_language_to_creates_parent_dirs() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a/b/config.toml");
        save_language_to(&path, "en").unwrap();
        assert!(path.exists());
    }
}
