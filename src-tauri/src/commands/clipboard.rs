use std::path::Path;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub fn copy_path_to_clipboard(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<(), String> {
    let text = paths.join("\n");
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_name_to_clipboard(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<(), String> {
    let names: Vec<String> = paths
        .iter()
        .filter_map(|p| {
            Path::new(p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
        })
        .collect();
    let text = names.join("\n");
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}
