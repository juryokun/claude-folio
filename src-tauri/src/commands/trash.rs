use trash;

#[tauri::command]
pub fn move_to_trash(paths: Vec<String>) -> Result<(), String> {
    for path in &paths {
        trash::delete(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
