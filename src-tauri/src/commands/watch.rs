use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn watch_dir(path: String, app: AppHandle, state: State<WatcherState>) -> Result<(), String> {
    let app_clone = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        let relevant = matches!(
            event.kind,
            EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
        );
        if relevant {
            let _ = app_clone.emit("folio:dir-changed", ());
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    // Replace old watcher (drops it, stopping the previous watch)
    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_dir(state: State<WatcherState>) {
    *state.0.lock().unwrap() = None;
}
