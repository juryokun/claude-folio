use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    #[serde(default = "default_date_format")]
    pub date_format: String,
    #[serde(default = "default_size_unit")]
    pub size_unit: String,
}

fn default_date_format() -> String { "%Y/%m/%d".to_string() }
fn default_size_unit() -> String { "binary".to_string() }

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            date_format: "%Y/%m/%d".to_string(),
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

const SAMPLE_CONFIG: &str = r#"# mac-filer 設定ファイル
# 場所: ~/.config/mac-filer/config.toml
# 編集後はアプリを再起動すると反映されます。

# -------------------------
# 表示設定
# -------------------------
[appearance]

# 「更新日」列の日付フォーマット
# 使えるトークン: %Y=年 %m=月 %d=日 %H=時 %M=分 %S=秒
date_format = "%Y/%m/%d"

# ファイルサイズの単位
#   "binary"  → KiB / MiB / GiB (1024 ベース)
#   "decimal" → KB / MB / GB  (1000 ベース)
size_unit = "binary"

# -------------------------
# エディタ設定
# -------------------------
[editor]

# `e` キーでファイルを開くときのコマンド。
# 空のままにすると OS のデフォルトアプリで開きます（`o` キーと同じ動作）。
# 例: "code"、"nvim"、"emacs"、"subl"
command = ""

# -------------------------
# ターミナル設定
# -------------------------
[terminal]

# 方法 A: `open -a <app> <dir>` で起動するアプリ名。
# Terminal.app / iTerm / Warp / Ghostty などに対応。
# 空のままにすると Terminal.app を使用します。
# 例: "iTerm"、"Warp"、"Ghostty"
app = ""

# 方法 B: `open -a` に対応していないターミナル用の直接コマンド。
# ディレクトリパスが末尾の引数として渡されます。
# `command` が設定されている場合は `app` より優先されます。
# 例:
# command = "alacritty --working-directory"
# command = "kitty --directory"

# -------------------------
# キーバインド設定
# -------------------------
[keymap]
# デフォルトのキーバインドを上書きします。
# 値はキーシーケンスのリストです。シーケンスはスペース区切りのキー名で指定します。
#
# 例:
#   cursor_down     = ["j", "ArrowDown"]   # 複数のキーを割り当てる
#   delete_selected = ["d d"]              # 2 キーシーケンス
#   sort_name       = ["s n"]
#
# 利用可能なアクション一覧:
#
# --- カーソル移動 ---
#   cursor_down        カーソルを下へ          (デフォルト: j / ↓)
#   cursor_up          カーソルを上へ          (デフォルト: k / ↑)
#   cursor_first       先頭へ移動              (デフォルト: g g)
#   cursor_last        末尾へ移動              (デフォルト: G)
#
# --- ディレクトリ移動 ---
#   navigate_up        親ディレクトリへ        (デフォルト: h / ←)
#   navigate_into      ディレクトリに入る      (デフォルト: l / → / Enter)
#   go_back            前のディレクトリへ戻る  (デフォルト: H)
#   go_forward         次のディレクトリへ進む  (デフォルト: L)
#
# --- ファイル操作 ---
#   toggle_select      選択の切り替え          (デフォルト: Space)
#   delete_selected    ゴミ箱へ移動            (デフォルト: d d)
#   cut_selected       切り取り                (デフォルト: x x)
#   yank_selected      コピー                  (デフォルト: y y)
#   paste              ペースト                (デフォルト: p)
#   rename             リネーム                (デフォルト: r)
#   new_dir            新規フォルダ作成        (デフォルト: a)
#   new_file           新規ファイル作成        (デフォルト: A)
#   copy_path          パスをコピー            (デフォルト: y p)
#   copy_name          ファイル名をコピー      (デフォルト: y n)
#
# --- 開く ---
#   open_selected      ファイルを開く          (デフォルト: l / Enter)
#   open_terminal      ターミナルで開く        (デフォルト: o)
#   open_terminal_here カレントディレクトリ    (デフォルト: T)
#   open_with_app      アプリを指定して開く    (デフォルト: O)
#   open_editor        エディタで開く          (デフォルト: e)
#
# --- 検索・コマンド ---
#   enter_search       インクリメンタルサーチ  (デフォルト: /)
#   enter_command      コマンドパレット        (デフォルト: :)
#
# --- タブ ---
#   new_tab            新規タブ                (デフォルト: t)
#   close_tab          タブを閉じる            (デフォルト: q)
#   next_tab           次のタブ                (デフォルト: ])
#   prev_tab           前のタブ                (デフォルト: [)
#
# --- 表示 ---
#   toggle_hidden      隠しファイルの表示切替  (デフォルト: .)
#   toggle_sidebar     サイドバーの表示切替    (デフォルト: \)
#   toggle_preview     プレビューパネル切替    (デフォルト: P)
#   reload             ディレクトリを再読込    (デフォルト: R)
#   show_help          ヘルプを表示            (デフォルト: ?)
#
# --- ブックマーク・移動 ---
#   add_bookmark       ブックマークに追加      (デフォルト: B)
#   open_bookmark_picker  ブックマーク検索     (デフォルト: b)
#   focus_path_bar     パスバーにフォーカス    (デフォルト: Ctrl+L)
#   focus_zoxide       zoxide 検索             (デフォルト: z)
#
# --- ソート ---
#   sort_name          名前でソート（昇順）    (デフォルト: s n)
#   sort_name_desc     名前でソート（降順）    (デフォルト: s N)
#   sort_time          更新日時でソート（昇順）(デフォルト: s t)
#   sort_time_desc     更新日時でソート（降順）(デフォルト: s T)
#   sort_reverse       ソート順を逆にする      (デフォルト: s r)
"#;
