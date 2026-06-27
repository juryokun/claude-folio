use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    #[serde(default = "default_date_format")]
    pub date_format: String,
    #[serde(default = "default_size_unit")]
    pub size_unit: String,
}

fn default_date_format() -> String { "%Y/%m/%d %H:%M:%S".to_string() }
fn default_size_unit() -> String { "binary".to_string() }

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            date_format: "%Y/%m/%d %H:%M:%S".to_string(),
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
}

fn config_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        std::path::PathBuf::from(h)
            .join(".config")
            .join("folio")
            .join("config.toml")
    })
}

#[tauri::command]
pub fn load_config() -> AppConfig {
    let Some(path) = config_path() else {
        return AppConfig::default();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return AppConfig::default();
    };
    toml::from_str(&content).unwrap_or_else(|e| {
        eprintln!("[mac-filer] config parse error: {e}");
        AppConfig::default()
    })
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

const SAMPLE_CONFIG: &str = include_str!("../../assets/config.template.toml");
