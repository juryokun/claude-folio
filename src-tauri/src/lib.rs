mod commands;
use tauri::{Emitter, Manager};

fn ipc_sock_path() -> String {
    let uid = std::process::Command::new("id")
        .arg("-u")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "0".to_string());
    format!("/tmp/folio-{}.sock", uid)
}

fn start_ipc_listener(app: tauri::AppHandle) {
    use std::io::Read;
    use std::os::unix::net::UnixListener;

    let sock = ipc_sock_path();
    let _ = std::fs::remove_file(&sock);

    std::thread::spawn(move || {
        let listener = match UnixListener::bind(&sock) {
            Ok(l) => l,
            Err(_) => return,
        };
        for stream in listener.incoming() {
            if let Ok(mut s) = stream {
                let mut buf = String::new();
                if s.read_to_string(&mut buf).is_ok() {
                    let path = buf.trim().to_string();
                    let payload: Option<String> = if path.is_empty() { None } else { Some(path) };
                    let _ = app.emit("folio:open-tab", payload);
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_focus();
                    }
                }
            }
        }
    });
}

use commands::{
    bookmarks::{load_bookmarks, save_bookmarks},
    cli::{get_startup_path, install_cli},
    config::{init_config, load_config, save_language},
    clipboard::{copy_name_to_clipboard, copy_path_to_clipboard},
    fs::{check_copy_conflicts, copy_files, create_dir, create_file, detect_google_drive, list_dir, move_files, read_text_file, rename_file},
    search::{check_7zip_installed, compress_7zip, extract_7zip, search_files},
    system::suppress_ds_store,
    terminal::{check_zoxide_installed, list_applications, open_file, open_with_app, open_with_editor, open_terminal_at, zoxide_add, zoxide_query},
    trash::move_to_trash,
    watch::{watch_dir, unwatch_dir, WatcherState},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(std::sync::Mutex::new(None)))
        .setup(|app| {
            start_ipc_listener(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            open_file,
            list_applications,
            open_with_app,
            open_with_editor,
            get_startup_path,
            install_cli,
            load_config,
            init_config,
            save_language,
            list_dir,
            rename_file,
            check_copy_conflicts,
            copy_files,
            move_files,
            create_dir,
            create_file,
            read_text_file,
            detect_google_drive,
            move_to_trash,
            copy_path_to_clipboard,
            copy_name_to_clipboard,
            open_terminal_at,
            check_zoxide_installed,
            zoxide_query,
            zoxide_add,
            search_files,
            check_7zip_installed,
            compress_7zip,
            extract_7zip,
            suppress_ds_store,
            watch_dir,
            unwatch_dir,
            load_bookmarks,
            save_bookmarks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
