---
name: bump-version
description: バージョン番号を上げる。対象ファイルの更新・Cargo.lock の同期・コミットまで一括対応。
user-invocable: true
allowed-tools:
  - Bash(grep *)
  - Bash(cargo check *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git tag *)
  - Bash(git status *)
  - Edit
  - Read
---

# /bump-version

バージョンを指定の番号に上げ、コミットまで行う。

## 実行手順

### 1. 現在のバージョン確認

```bash
grep -n "version" src-tauri/Cargo.toml src-tauri/tauri.conf.json
```

### 2. バージョン番号の決定

引数で新バージョンが指定されていればそれを使う。指定がなければユーザーに確認する。

### 3. ファイル更新

以下の2ファイルを新バージョンに書き換える：

- `src-tauri/Cargo.toml` — `version = "x.y.z"`
- `src-tauri/tauri.conf.json` — `"version": "x.y.z"`

### 4. Cargo.lock の同期

バージョン変更後に `cargo check` を実行して `Cargo.lock` を更新する。

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

### 5. コミット

3ファイルをまとめてコミットする。`Cargo.lock` を忘れないこと。

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock
git commit -m "$(cat <<'EOF'
chore: bump version to <新バージョン>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### 6. タグ付け

コミット後に annotated tag を打つ。

```bash
git tag -a v<新バージョン> -m "v<新バージョン>"
```

### 7. 確認

```bash
git status && git tag --list "v<新バージョン>"
```

未コミットのファイルが残っておらず、タグが存在することを確認して完了を報告する。
