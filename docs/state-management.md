# 状態管理設計

## 概要

状態管理には **Zustand** を使用しています。責務ごとに5つのストアに分割されており、それぞれが独立して Tauri IPC や永続化レイヤーと通信します。

## ストア一覧と依存関係

![ストア依存関係](diagrams/store-dependencies.svg)

## 各ストアの詳細

### tabStore（`src/store/tabStore.ts`）

タブの開閉・切り替え・ナビゲーション履歴を管理します。

| 状態 | 型 | 説明 |
|---|---|---|
| `tabs` | `Tab[]` | 開いているタブの一覧 |
| `activeTabId` | `string` | 現在アクティブなタブの ID |

各タブは `id / path / history[] / historyIndex` を持ち、`H`/`L` キーで戻る・進む履歴を実現しています。

`navigateTo()` はナビゲート時に `zoxide_add` を呼び出し、移動先を zoxide のデータベースに自動登録します。

---

### fileStore（`src/store/fileStore.ts`）

ファイル一覧・カーソル位置・選択状態・クリップボードを管理します。**タブ ID をキーとした `panes` マップで複数タブに対応しています。**

| 状態 | 型 | 説明 |
|---|---|---|
| `panes` | `Record<string, PaneState>` | タブ ID → ペイン状態 のマップ |
| `clipboard` | `ClipboardState \| null` | コピー/カット対象のパス一覧とモード |

`PaneState` の主なフィールド:

| フィールド | 説明 |
|---|---|
| `entries` | 現在のディレクトリのファイル一覧 |
| `cursor` | カーソル位置（インデックス） |
| `selected` | 複数選択中のパスの集合 |
| `filterQuery` | インクリメンタルサーチの検索文字列 |
| `sortKey / sortDesc` | ソートキーと昇降順 |
| `pendingFocusName` | 次回ロード時にフォーカスするエントリ名 |

`filteredEntries()` はフィルタリングとソート（ディレクトリ優先）を適用した配列を返します。ディレクトリが削除されていた場合は自動的に親ディレクトリへフォールバックします。

---

### uiStore（`src/store/uiStore.ts`）

UI 状態全般（モーダル表示・Vim モード・レイアウト設定）を管理します。一部は **localStorage に永続化**されます。

| 永続化される状態 | 説明 |
|---|---|
| `showHidden` | 隠しファイルの表示/非表示 |
| `showSidebar` | サイドバー表示状態 |
| `sidebarWidth` | サイドバー幅 |
| `columnWidths` | size/date カラム幅 |
| `showPreview` | プレビューパネル表示状態 |
| `previewWidth` | プレビューパネル幅 |

localStorage のキー名は `folio-ui` です。

`vimMode` は永続化されません（起動時は常に `NORMAL`）。

---

### configStore（`src/store/configStore.ts`）

`~/.config/folio/config.toml` から読み込んだ設定を保持します。

| 状態 | 説明 |
|---|---|
| `appearance` | 日付フォーマット・サイズ単位 |
| `keymap` | キーバインドのカスタマイズ（デフォルトに上書きマージ） |
| `favorites` | サイドバーに表示するお気に入り |

`load()` は起動時に一度だけ呼び出され、読み込んだ設定を `uiStore` の `setEditorCommand`・`setTerminalApp`・`setLanguage` にも伝播させます。

キーマップのカスタマイズは「上書きマージ方式」です。設定でオーバーライドするアクションのデフォルトバインドを削除してから、新しいバインドを追加します。

---

### bookmarkStore（`src/store/bookmarkStore.ts`）

ユーザーが追加したブックマーク一覧を管理します。

操作（追加・削除・並び替え）のたびに `save_bookmarks` コマンドを呼び出してファイルに永続化します。ブックマークファイルのパスは Rust 側（`~/.local/share/folio/` 相当）で管理されます。

## ストア間の依存関係

```
fileStore ──依存→ tabStore   （activeTab().id を使ってペインを特定）
configStore ──通知→ uiStore  （設定値を起動時に push）
```

`fileStore` が `tabStore` の状態を参照する際は `useTabStore.getState()` を使って直接アクセスします（React のコンポーネントツリー外で呼び出すため）。

## データフロー例：ディレクトリ移動

```
ユーザーが「l」キー押下
  → useVimKeys が navigate_into アクションを発火
  → useFileOps の handleNavigateInto() が実行
  → tabStore.navigateTo(path) でタブのパスを更新
      → zoxide_add を非同期で呼び出し
  → App.tsx の useEffect がパス変化を検知
  → fileStore.loadDir(tabId, newPath) を呼び出し
  → list_dir IPC コマンドを実行
  → entries, cursor をリセットして状態を更新
  → FilePane が再レンダリング
```
