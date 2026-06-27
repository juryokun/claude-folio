use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    /// strftime-like: %Y %m %d %H %M %S
    pub date_format: String,
    /// "binary" (KiB/MiB) or "decimal" (KB/MB)
    pub size_unit: String,
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            date_format: "%Y/%m/%d".to_string(),
            size_unit: "binary".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub appearance: AppearanceConfig,
    /// action_name -> list of key sequences ("j", "d d", "s n" …)
    #[serde(default)]
    pub keymap: HashMap<String, Vec<String>>,
}

fn config_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        std::path::PathBuf::from(h)
            .join(".config")
            .join("mac-filer")
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

/// Write a sample config to ~/.config/mac-filer/config.toml if it doesn't exist.
#[tauri::command]
pub fn init_config() -> Result<String, String> {
    let path = config_path().ok_or("HOME not set")?;
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, SAMPLE_CONFIG).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

const SAMPLE_CONFIG: &str = r#"# mac-filer configuration
# ~/.config/mac-filer/config.toml

[appearance]
# Date format for the "更新日" column.
# Tokens: %Y=year %m=month %d=day %H=hour %M=minute %S=second
date_format = "%Y/%m/%d"

# Size unit: "binary" (KiB, MiB, GiB) or "decimal" (KB, MB, GB)
size_unit = "binary"

[keymap]
# Override default keybindings.
# Each value is a list of key sequences; a sequence is space-separated key names.
# Examples:
#   cursor_down  = ["j", "ArrowDown"]
#   delete_selected = ["d d"]
#   sort_name    = ["s n"]
#
# Available actions:
#   cursor_down, cursor_up, cursor_first, cursor_last
#   navigate_up, navigate_into
#   go_back, go_forward
#   toggle_select
#   delete_selected, cut_selected, yank_selected, paste
#   enter_search, enter_command
#   copy_path, copy_name
#   open_terminal, rename, new_dir
#   new_tab, close_tab, next_tab, prev_tab
#   focus_path_bar, focus_zoxide
#   toggle_hidden, show_help, open_selected
#   add_bookmark
#   sort_name, sort_name_desc, sort_time, sort_time_desc, sort_reverse
"#;
