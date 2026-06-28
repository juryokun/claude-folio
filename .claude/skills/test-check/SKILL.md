---
name: test-check
description: TypeScript 型チェック・Rust コンパイルチェック・全テストを順に実行して結果を報告する。実装後や PR 前の確認に使う。
user-invocable: true
allowed-tools:
  - Bash(npx tsc --noEmit *)
  - Bash(cargo check *)
  - Bash(cargo test *)
  - Bash(npm test *)
---

# /test-check

以下の順に実行し、各ステップの結果を報告する。エラーがあった時点で止めて内容を示す。

## 実行手順

### 1. TypeScript 型チェック
```bash
npx tsc --noEmit 2>&1
```
エラーがあればファイル名・行番号・メッセージを示す。

### 2. Rust コンパイルチェック
```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
```
エラーがあれば内容を示す。

### 3. Rust テスト
```bash
cargo test --manifest-path src-tauri/Cargo.toml 2>&1
```

### 4. フロントエンドテスト
```bash
npm test 2>&1
```

## 報告形式

```
## テスト結果

| チェック | 結果 |
|---|---|
| TS 型チェック | ✅ OK / ❌ エラーあり |
| Rust コンパイル | ✅ OK / ❌ エラーあり |
| Rust テスト | ✅ XX件 passed / ❌ エラーあり |
| フロントエンドテスト | ✅ XX件 passed / ❌ エラーあり |

### エラー詳細（ある場合）
[エラー内容]
```

全て ✅ の場合は「全チェック通過。コミット可能です。」と伝える。
