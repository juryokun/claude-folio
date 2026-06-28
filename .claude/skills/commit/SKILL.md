---
name: commit
description: テスト・lint を通してからコミットする定型手順。実装完了後に使う。
user-invocable: true
allowed-tools:
  - Bash(npx tsc --noEmit *)
  - Bash(cargo check *)
  - Bash(cargo test *)
  - Bash(npm test *)
  - Bash(npm run check:fix *)
  - Bash(cargo fmt *)
  - Bash(cargo clippy *)
  - Bash(git diff *)
  - Bash(git status *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git log *)
---

# /commit

コミット前チェックを実施し、問題がなければコミットする。

## 実行手順

### 1. 変更内容の確認
```bash
git diff && git status
```
何を変更したか把握する。

### 2. フォーマット適用
```bash
npm run check:fix 2>&1 | tail -5
cargo fmt --manifest-path src-tauri/Cargo.toml
```

### 3. チェック実行
```bash
npx tsc --noEmit 2>&1
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings 2>&1 | tail -10
```

### 4. テスト実行
```bash
cargo test --manifest-path src-tauri/Cargo.toml 2>&1
npm test 2>&1
```

### 5. エラーがあれば止まる
いずれかのステップでエラーがあった場合はコミットせず、内容をユーザーに報告して対処を仰ぐ。

### 6. コミット
全チェックが通過したら、変更内容を踏まえた適切なコミットメッセージを作成してコミットする。

```bash
git add <変更ファイル>
git commit -m "$(cat <<'EOF'
<コミットメッセージ>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

コミットメッセージの方針：
- 英語で書く
- 1行目: 変更の種別と概要（例: `feat: add image display to file preview panel`）
- 種別: `feat` / `fix` / `refactor` / `test` / `docs` / `chore`
