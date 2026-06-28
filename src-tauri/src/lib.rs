mod commands;

#[cfg(not(test))]
use tauri::{Emitter, Manager};

#[cfg(not(test))]
use commands::{
    bookmarks::{load_bookmarks, save_bookmarks},
    cli::{get_startup_path, install_cli},
    clipboard::{copy_name_to_clipboard, copy_path_to_clipboard},
    config::{init_config, load_config, save_language},
    custom_commands::{load_custom_commands, run_shell_command},
    fs::{
        check_copy_conflicts, copy_files, create_dir, create_file, detect_google_drive, list_dir,
        list_dir_completions, move_files, read_text_file, rename_file,
    },
    search::{
        check_7zip_installed, check_fd_installed, compress_7zip, extract_7zip, search_files,
        search_with_fd,
    },
    system::suppress_ds_store,
    terminal::{
        check_zoxide_installed, list_applications, open_file, open_terminal_at, open_with_app,
        open_with_editor, quick_look, zoxide_add, zoxide_query,
    },
    trash::move_to_trash,
    watch::{unwatch_dir, watch_dir, WatcherState},
};

#[cfg(not(test))]
fn ipc_sock_path() -> String {
    let uid = std::process::Command::new("id")
        .arg("-u")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "0".to_string());
    format!("/tmp/folio-{}.sock", uid)
}

#[cfg(not(test))]
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
        for mut s in listener.incoming().flatten() {
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
    });
}

#[cfg(not(test))]
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
            list_dir_completions,
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
            quick_look,
            check_zoxide_installed,
            zoxide_query,
            zoxide_add,
            search_files,
            check_fd_installed,
            search_with_fd,
            check_7zip_installed,
            compress_7zip,
            extract_7zip,
            suppress_ds_store,
            watch_dir,
            unwatch_dir,
            load_bookmarks,
            save_bookmarks,
            load_custom_commands,
            run_shell_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod integration_tests {
    use crate::commands::{
        bookmarks::{load_bookmarks_from, save_bookmarks_to, BookmarkEntry},
        config::{load_config_from, save_language_to},
        fs::{
            check_copy_conflicts, copy_files, create_dir, create_file, list_dir, move_files,
            read_text_file, rename_file,
        },
    };
    use std::fs;
    use tempfile::TempDir;

    // ── ファイルシステム・ライフサイクル ─────────────────────────────────────

    #[test]
    fn create_file_visible_in_list_dir() {
        let dir = TempDir::new().unwrap();
        create_file(dir.path().join("note.txt").to_string_lossy().to_string()).unwrap();

        let entries = list_dir(dir.path().to_string_lossy().to_string(), false).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "note.txt");
        assert!(!entries[0].is_dir);
    }

    #[test]
    fn rename_reflected_in_subsequent_list_dir() {
        let dir = TempDir::new().unwrap();
        let old = dir.path().join("old.txt");
        let new = dir.path().join("new.txt");
        create_file(old.to_string_lossy().to_string()).unwrap();

        rename_file(
            old.to_string_lossy().to_string(),
            new.to_string_lossy().to_string(),
        )
        .unwrap();

        let entries = list_dir(dir.path().to_string_lossy().to_string(), false).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "new.txt");
    }

    #[test]
    fn move_file_disappears_from_source_appears_in_dest() {
        let src = TempDir::new().unwrap();
        let dest = TempDir::new().unwrap();
        let file = src.path().join("data.txt");
        create_file(file.to_string_lossy().to_string()).unwrap();

        move_files(
            vec![file.to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
        )
        .unwrap();

        let src_entries = list_dir(src.path().to_string_lossy().to_string(), false).unwrap();
        let dest_entries = list_dir(dest.path().to_string_lossy().to_string(), false).unwrap();
        assert!(src_entries.is_empty(), "source should be empty after move");
        assert_eq!(dest_entries.len(), 1);
        assert_eq!(dest_entries[0].name, "data.txt");
    }

    #[test]
    fn full_workflow_create_write_copy_read() {
        let work = TempDir::new().unwrap();
        let archive = TempDir::new().unwrap();

        // サブディレクトリとファイルを作成
        let subdir = work.path().join("project");
        create_dir(subdir.to_string_lossy().to_string()).unwrap();
        let file = subdir.join("main.rs");
        create_file(file.to_string_lossy().to_string()).unwrap();
        fs::write(&file, b"fn main() {}").unwrap();

        // list_dir がディレクトリを先頭に返すことを確認
        let entries = list_dir(work.path().to_string_lossy().to_string(), false).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_dir);
        assert_eq!(entries[0].name, "project");

        // ファイルを archive ディレクトリへコピー
        copy_files(
            vec![file.to_string_lossy().to_string()],
            archive.path().to_string_lossy().to_string(),
            "rename".to_string(),
        )
        .unwrap();

        // コピー先でファイル内容を読み取り
        let content = read_text_file(
            archive.path().join("main.rs").to_string_lossy().to_string(),
            1024,
        )
        .unwrap();
        assert_eq!(content, "fn main() {}");
    }

    #[test]
    fn copy_recursive_directory() {
        let src = TempDir::new().unwrap();
        let dest = TempDir::new().unwrap();

        let subdir = src.path().join("subdir");
        create_dir(subdir.to_string_lossy().to_string()).unwrap();
        fs::write(subdir.join("a.txt"), b"aaa").unwrap();
        fs::write(subdir.join("b.txt"), b"bbb").unwrap();

        copy_files(
            vec![subdir.to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
            "rename".to_string(),
        )
        .unwrap();

        let copied = dest.path().join("subdir");
        assert!(copied.is_dir());
        assert_eq!(fs::read(copied.join("a.txt")).unwrap(), b"aaa");
        assert_eq!(fs::read(copied.join("b.txt")).unwrap(), b"bbb");
    }

    // ── コピー競合の検出 → 解決の連鎖 ───────────────────────────────────────

    #[test]
    fn detect_conflict_then_overwrite() {
        let src = TempDir::new().unwrap();
        let dest = TempDir::new().unwrap();
        fs::write(src.path().join("file.txt"), b"new content").unwrap();
        fs::write(dest.path().join("file.txt"), b"old content").unwrap();

        let conflicts = check_copy_conflicts(
            vec![src.path().join("file.txt").to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
        );
        assert_eq!(conflicts, vec!["file.txt"]);

        copy_files(
            vec![src.path().join("file.txt").to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
            "overwrite".to_string(),
        )
        .unwrap();
        assert_eq!(
            fs::read(dest.path().join("file.txt")).unwrap(),
            b"new content"
        );
    }

    #[test]
    fn detect_conflict_then_rename_keeps_both() {
        let src = TempDir::new().unwrap();
        let dest = TempDir::new().unwrap();
        fs::write(src.path().join("file.txt"), b"new").unwrap();
        fs::write(dest.path().join("file.txt"), b"old").unwrap();

        copy_files(
            vec![src.path().join("file.txt").to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
            "rename".to_string(),
        )
        .unwrap();

        let entries = list_dir(dest.path().to_string_lossy().to_string(), false).unwrap();
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"file.txt"), "元ファイルが残っていること");
        assert!(
            names.contains(&"file_1.txt"),
            "リネームコピーが存在すること"
        );
        assert_eq!(fs::read(dest.path().join("file.txt")).unwrap(), b"old");
        assert_eq!(fs::read(dest.path().join("file_1.txt")).unwrap(), b"new");
    }

    #[test]
    fn no_conflict_when_dest_is_empty() {
        let src = TempDir::new().unwrap();
        let dest = TempDir::new().unwrap();
        fs::write(src.path().join("only.txt"), b"x").unwrap();

        let conflicts = check_copy_conflicts(
            vec![src.path().join("only.txt").to_string_lossy().to_string()],
            dest.path().to_string_lossy().to_string(),
        );
        assert!(conflicts.is_empty());
    }

    // ── 設定ファイルのラウンドトリップ ───────────────────────────────────────

    #[test]
    fn save_then_load_config_language_ja() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");

        save_language_to(&path, "ja").unwrap();
        assert_eq!(load_config_from(&path).language, "ja");
    }

    #[test]
    fn save_then_load_config_language_en() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");

        save_language_to(&path, "en").unwrap();
        assert_eq!(load_config_from(&path).language, "en");
    }

    #[test]
    fn update_language_twice_reflects_latest() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");

        save_language_to(&path, "ja").unwrap();
        save_language_to(&path, "en").unwrap();
        assert_eq!(load_config_from(&path).language, "en");
    }

    #[test]
    fn save_language_preserves_existing_toml_keys() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config.toml");

        fs::write(
            &path,
            "[appearance]\nsize_unit = \"binary\"\nlanguage = \"ja\"\n",
        )
        .unwrap();
        save_language_to(&path, "en").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert!(
            content.contains("size_unit"),
            "appearance セクションが保持されていること"
        );
        assert!(
            content.contains("language = \"en\""),
            "言語が更新されていること"
        );
    }

    // ── ブックマークのラウンドトリップ ───────────────────────────────────────

    #[test]
    fn save_then_load_bookmarks_roundtrip() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        let bookmarks = vec![
            BookmarkEntry {
                label: "Home".to_string(),
                path: "/Users/user".to_string(),
            },
            BookmarkEntry {
                label: "Work".to_string(),
                path: "/Users/user/work".to_string(),
            },
        ];

        save_bookmarks_to(&path, bookmarks.clone()).unwrap();
        assert_eq!(load_bookmarks_from(&path), bookmarks);
    }

    #[test]
    fn add_bookmark_then_remove_bookmark() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");

        assert!(load_bookmarks_from(&path).is_empty());

        let bm = BookmarkEntry {
            label: "Projects".to_string(),
            path: "/projects".to_string(),
        };
        save_bookmarks_to(&path, vec![bm]).unwrap();
        assert_eq!(load_bookmarks_from(&path).len(), 1);

        save_bookmarks_to(&path, vec![]).unwrap();
        assert!(load_bookmarks_from(&path).is_empty());
    }

    #[test]
    fn reorder_bookmarks_persisted() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");

        let mk = |l: &str, p: &str| BookmarkEntry {
            label: l.to_string(),
            path: p.to_string(),
        };
        save_bookmarks_to(&path, vec![mk("A", "/a"), mk("B", "/b"), mk("C", "/c")]).unwrap();

        // B を先頭に移動
        let mut bms = load_bookmarks_from(&path);
        let moved = bms.remove(1);
        bms.insert(0, moved);
        save_bookmarks_to(&path, bms).unwrap();

        let reloaded = load_bookmarks_from(&path);
        assert_eq!(
            reloaded
                .iter()
                .map(|b| b.label.as_str())
                .collect::<Vec<_>>(),
            vec!["B", "A", "C"]
        );
    }

    #[test]
    fn multiple_bookmarks_order_preserved() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bookmarks.toml");
        let bookmarks: Vec<BookmarkEntry> = (0..5)
            .map(|i| BookmarkEntry {
                label: format!("B{i}"),
                path: format!("/path/{i}"),
            })
            .collect();

        save_bookmarks_to(&path, bookmarks.clone()).unwrap();
        let loaded = load_bookmarks_from(&path);
        assert_eq!(loaded, bookmarks);
    }
}
