# CLAUDE.md

このファイルは、リポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

## コマンド

```bash
# 開発 (Tauri アプリ)
npm run tauri dev           # フルアプリ起動 (Rust + React)
npm run dev                 # フロントエンドのみ (Vite)

# ビルド
npm run build               # TypeScript + Vite ビルド
cargo build --manifest-path src-tauri/Cargo.toml

# テスト
cargo test --manifest-path src-tauri/Cargo.toml           # Rust テスト全件
cargo test --manifest-path src-tauri/Cargo.toml -- <テスト名>  # 単体テスト
npm test                    # Vitest (フロントエンド)

# Lint / Format
npm run check:fix           # Biome (TS/TSX) — lint + format を一括実行
npm run clippy              # Rust lint (-D warnings)
cargo fmt --manifest-path src-tauri/Cargo.toml  # Rust フォーマット (設定: src-tauri/.rustfmt.toml)
```

## アーキテクチャ

**Folio** — macOS 向け Vim ライクなファイルマネージャ。Tauri 2 (Rust バックエンド) + React 19 / TypeScript (フロントエンド) 構成。

### IPC 境界

Rust↔TS 間の通信はすべて Tauri の `invoke()` を経由する。対応関係は 2 箇所で管理：
- **Rust 側**: `src-tauri/src/commands/` — ドメインごとにファイル分割 (fs, git, terminal, search, …)
- **TS 側**: `src/lib/tauri.ts` — `invoke()` の薄いラッパー、戻り値の型付きで定義

新しい Tauri コマンドを追加する際は `src-tauri/src/lib.rs` の `invoke_handler!` と `src/lib/tauri.ts` の両方に登録する。

### フロントエンドの状態管理

`src/store/` 配下の Zustand ストア：
- `fileStore` — タブごとのディレクトリエントリ、カーソル、選択状態、git ステータス、find モード結果
- `tabStore` — タブ一覧、ナビゲーション履歴、アクティブタブ
- `uiStore` — モーダル表示状態、サイドバー、vim モード、パネル状態
- `configStore` — 永続化設定 (言語、外観)
- `bookmarkStore`, `customCommandStore` — サイドバーブックマーク、ユーザー定義シェルコマンド

`fileStore.panes` は `tabId` をキーとする。ペイン状態の読み書き時は必ず `tabId` を渡す。

### Vim キー層

`src/hooks/useVimKeys.ts` がキーボードイベントを `VimAction` 値 (`src/lib/vim/keymap.ts` で定義) に変換する。各アクションの副作用 (Tauri 呼び出し、ストア更新) は `useFileOps.ts` が担当する。

### テスト方針

実装時は必ずテストコードを書く。テストが書けない・書く価値が極めて低い場合はその理由を説明する。

**テストが書きにくい箇所とその理由**:
- React コンポーネント (`src/components/`) — キーボード操作主体の TUI ライク UI はレンダリングテストの費用対効果が低い。代わりにロジックを hooks・純粋関数に切り出してそちらをテストする
- Tauri プラグイン直呼び出し (`open_file`, `open_terminal_at` 等) — OS・外部アプリへの副作用を伴うため自動テスト不可

**Rust**: テスト対象の関数は `AppHandle` やグローバルパスの代わりに明示的なパスを受け取る `_from` / `_to` バリアントを公開する (例: `load_config_from(&path)`, `save_bookmarks_to(&path, …)`)。インテグレーションテストは `src-tauri/src/lib.rs` にまとめ、`tempfile::TempDir` を使用。

**フロントエンド**: `src/store/__tests__/` と `src/lib/__tests__/` にテストを配置。テストが必要なロジックは純粋関数として切り出す (例: `searchFilter.ts`, `pathCompletion.ts`)。

### Unix Socket IPC (CLI → アプリ)

起動中のアプリは `/tmp/folio-<uid>.sock` をリッスンする。CLI (`install_cli` コマンド) がこのソケットにパスを書き込んで新しいタブを開く。アプリは Tauri イベントバスで `folio:open-tab` を emit する。
