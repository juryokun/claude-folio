---
name: bump-version
description: バージョン番号を上げる。対象ファイルの更新・Cargo.lock の同期・CHANGELOG.md の更新・コミットまで一括対応。
user-invocable: true
allowed-tools:
  - Bash(grep *)
  - Bash(cargo check *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git log *)
  - Bash(git show *)
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

### 5. CHANGELOG.md の更新

`git log <前バージョンタグ>..HEAD` でコミット一覧を取得し、ユーザー向けの変更をまとめて `CHANGELOG.md` の先頭に追記する。

```bash
git log v<前バージョン>..HEAD --oneline
```

- `feat:` → `### Features`、`fix:` → `### Bug Fixes`、`perf:` → `### Performance` に分類する
- `chore:` `docs:` `test:` `refactor:` はユーザー向けでないため原則除外する
- ただし `chore:` でも UI/UX に影響するものは含める
- 各項目はユーザー視点の平易な英語で書く（コミットメッセージをそのままコピーしない）
- バージョンバンプ自体のコミットは除外する

追記フォーマット：

```markdown
## [<新バージョン>] - <today's date: YYYY-MM-DD>

### Features

- **Feature name** — 説明

### Bug Fixes

- **Fix name** — 説明

### Performance

- **Improvement name** — 説明
```

該当カテゴリが空の場合はそのセクションを省略する。

### 6. コミット

4ファイルをまとめてコミットする。`Cargo.lock` と `CHANGELOG.md` を忘れないこと。

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock CHANGELOG.md
git commit -m "$(cat <<'EOF'
chore: bump version to <新バージョン>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### 7. 確認

```bash
git status
```

未コミットのファイルが残っていないことを確認して完了を報告する。
