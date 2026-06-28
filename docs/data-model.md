# データモデル

## TypeScript データ型

アプリ全体で使われる型は `src/types.ts` と各ストアに定義されています。

![TypeScript データモデル](diagrams/data-model.svg)

### コアエンティティ

#### FileEntry

ファイルシステム上の1エントリ（ファイルまたはディレクトリ）を表します。`list_dir` コマンドの戻り値として Rust 側から生成され、TS 側に渡されます。

```ts
interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  link_target?: string;
  size: number;
  modified?: number;   // Unix タイムスタンプ (秒)
  extension?: string;
}
```

#### Tab

1つのタブのナビゲーション状態を表します。`id` が `fileStore.panes` のキーになります。

```ts
interface Tab {
  id: string;          // crypto.randomUUID() で生成
  path: string;        // 現在表示中のディレクトリパス
  history: string[];   // 移動履歴
  historyIndex: number;
}
```

#### Bookmark

ユーザーが登録したブックマーク。`id` はフロントエンドが UUID で付与します（Rust 側の `BookmarkEntry` には `id` がありません）。

```ts
interface Bookmark {
  id: string;
  label: string;
  path: string;
}
```

### 複合状態型

#### PaneState

1タブ分のファイルペイン状態です。`fileStore.panes` に `Record<tabId, PaneState>` として保持されます。

| フィールド | 説明 |
|---|---|
| `entries` | 現在のディレクトリの全エントリ（`FileEntry[]`） |
| `cursor` | カーソル位置（フィルタ後のインデックス） |
| `selected` | 複数選択中のパスの集合 |
| `filterQuery` | インクリメンタルサーチの検索文字列 |
| `pendingFocusName` | 次回ロード時にフォーカスするエントリ名 |
| `sortKey` | ソートキー（`name` または `time`） |
| `sortDesc` | ソート降順フラグ |

#### ClipboardState

コピー・カット対象のパス一覧と操作モードを保持します。`fileStore.clipboard` として管理されます。

```ts
interface ClipboardState {
  paths: string[];
  mode: 'copy' | 'cut';  // ClipboardMode
}
```

#### KeyBinding

1つのキーバインドを表します。`keys` はシーケンス内のキー名の配列で、`action` は実行する操作を示します。

```ts
interface KeyBinding {
  keys: string[];    // 例: ['g', 'g'], ['y', 'y']
  action: VimAction; // 例: 'cursor_first', 'yank_selected'
}
```

### Union / Enum 型

| 型名 | 値 | 用途 |
|---|---|---|
| `ClipboardMode` | `copy` / `cut` | クリップボード操作の種類 |
| `VimMode` | `NORMAL` / `SEARCH` / `COMMAND` | 現在の入力モード |
| `SortKey` | `name` / `time` | ファイル一覧のソートキー |
| `TerminalEmulator` | `terminal` / `iterm2` / `warp` | ターミナルアプリの識別 |
| `VimAction` | 40+ の文字列ユニオン | キーバインドに割り当てる操作 |

---

## Rust ↔ TypeScript 型対応（IPC 境界）

Tauri の IPC を通じてデータが受け渡される際、Rust の構造体は JSON にシリアライズされ TypeScript の型にデシリアライズされます。

![IPC 型対応](diagrams/ipc-types.svg)

### FileEntry — フィールド名変換

Rust 側は `snake_case`、TypeScript 側はそのまま `snake_case` で受け取ります（Tauri はデフォルトで変換しません）。フィールドの意味は完全に対応しています。

| Rust | TypeScript | 型の変換 |
|---|---|---|
| `name: String` | `name: string` | そのまま |
| `is_dir: bool` | `is_dir: boolean` | そのまま |
| `size: u64` | `size: number` | u64 → number（精度注意） |
| `modified: Option<u64>` | `modified?: number` | Option → optional |
| `link_target: Option<String>` | `link_target?: string` | Option → optional |

### Bookmark — id はフロントエンドが付与

Rust の `BookmarkEntry` は `{label, path}` のみを持ち、ファイルに永続化されます。フロントエンドが読み込む際に `crypto.randomUUID()` で `id` を付与して `Bookmark` に変換します。

```
BookmarkEntry (Rust)    →    Bookmark (TypeScript)
{ label, path }              { id: UUID, label, path }
```

### AppConfig — フロントエンド側で分解して適用

Rust の `AppConfig` は設定ファイル全体の構造体です。`load_config()` で一度に読み込み、フロントエンドの `configStore.load()` が各フィールドを分解して複数のストアに設定します。

| AppConfig フィールド | 適用先 |
|---|---|
| `appearance` | `configStore.appearance` |
| `editor.command` | `uiStore.editorCommand` |
| `terminal.app / command` | `uiStore.terminalApp / terminalCommand` |
| `keymap` | `configStore.keymap`（デフォルトへマージ） |
| `sidebar.favorites` | `configStore.favorites` |
| `language` | `uiStore.language` |

### 設定ファイルのパス

| ファイル | パス |
|---|---|
| メイン設定 | `~/.config/folio/config.toml` |
| ブックマーク | `~/.config/folio/bookmarks.toml` |
