# アーキテクチャ概要

## システム構成

mac-filer（内部名: folio）は **Tauri v2** を使用した macOS 向けデスクトップアプリです。
フロントエンド（React + TypeScript）とバックエンド（Rust）の二層構造で、両者は Tauri IPC を介して通信します。

![アーキテクチャ全体図](diagrams/architecture.svg)

## 各レイヤーの責務

### フロントエンド（React / TypeScript）

フロントエンド内のデータは左から右へ一方向に流れます。

![フロントエンド内部フロー](diagrams/frontend-flow.svg)

| 層 | 主なファイル | 責務 |
|---|---|---|
| UI コンポーネント | `src/components/` | 画面描画・ユーザーイベント受付 |
| Hooks | `src/hooks/` | キー入力処理・ファイル操作ロジック |
| Zustand ストア | `src/store/` | アプリ状態の保持と更新 |
| tauriApi | `src/lib/tauri.ts` | Rust コマンドへの IPC 呼び出しのラッパー |

### バックエンド（Rust / Tauri）

| モジュール | ファイル | 責務 |
|---|---|---|
| fs | `commands/fs.rs` | ディレクトリ一覧・ファイルの作成/コピー/移動/リネーム |
| trash | `commands/trash.rs` | ゴミ箱への移動 |
| terminal | `commands/terminal.rs` | ターミナル起動・アプリ起動・zoxide 連携 |
| search | `commands/search.rs` | ファイル検索・7zip 圧縮/展開 |
| bookmarks | `commands/bookmarks.rs` | ブックマークの保存と読み込み |
| config | `commands/config.rs` | 設定ファイルの読み書き |
| watch | `commands/watch.rs` | ディレクトリ変更の監視 |
| system | `commands/system.rs` | DS_Store 抑制などの macOS 固有処理 |
| clipboard | `commands/clipboard.rs` | パス/ファイル名のクリップボードコピー |

## IPC 通信の種類

### 1. Tauri invoke（フロントエンド → バックエンド）

フロントエンドの `tauriApi` が `invoke()` を呼び出し、Rust のコマンド関数を実行します。
戻り値は `Promise` として受け取ります。

```ts
// 例: ディレクトリ一覧取得
const entries = await invoke<FileEntry[]>('list_dir', { path, showHidden });
```

### 2. Unix Socket（CLI → バックエンド → フロントエンド）

アプリ起動時に `/tmp/folio-{UID}.sock` に Unix ドメインソケットサーバーを立ち上げます。
`folio` CLI ツールがこのソケットにパスを送信すると、バックエンドが `folio:open-tab` イベントをフロントエンドに emit し、指定パスで新規タブが開きます。

```
folio /path/to/dir  →  Unix Socket  →  Rust サーバー  →  folio:open-tab イベント  →  React
```

### 3. Tauri Plugin（バックエンド → OS）

以下のプラグインを使用しています。

| プラグイン | 用途 |
|---|---|
| `tauri-plugin-opener` | ファイルをデフォルトアプリで開く |
| `tauri-plugin-shell` | シェルコマンドの実行 |
| `tauri-plugin-clipboard-manager` | クリップボード操作 |
| `tauri-plugin-drag` | ネイティブドラッグ操作 |

## ディレクトリ構成

```
mac-filer/
├── src/                    # フロントエンド (TypeScript / React)
│   ├── components/         # UI コンポーネント
│   │   ├── pane/           # ファイルペイン（メイン表示領域）
│   │   ├── modals/         # モーダルダイアログ群
│   │   ├── sidebar/        # サイドバー（お気に入り・ブックマーク）
│   │   ├── tabs/           # タブバー
│   │   ├── search/         # 検索バー
│   │   ├── preview/        # プレビューパネル
│   │   └── help/           # キーバインド一覧ヘルプ
│   ├── hooks/              # カスタム Hooks
│   ├── store/              # Zustand ストア
│   ├── lib/                # ユーティリティ・i18n・キーマップ定義
│   └── types.ts            # 共通型定義
└── src-tauri/              # バックエンド (Rust)
    └── src/
        ├── commands/       # Tauri コマンド実装
        ├── lib.rs          # アプリ初期化・IPC サーバー起動
        └── main.rs         # エントリーポイント
```
