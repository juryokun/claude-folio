---
name: polish-commits
description: push やプルリク前にコミット履歴を整える。粒度・順序・メッセージの品質を評価し、rebase 方針をユーザーに提示してから実行する。
user-invocable: true
allowed-tools:
  - Bash(git log *)
  - Bash(git diff *)
  - Bash(git status *)
  - Bash(git rebase *)
  - Bash(git show *)
---

# /polish-commits

push・PR 作成前にコミット履歴を整える。**必ずユーザーの承認を得てから rebase を実行する。**

## 実行手順

### Step 1: 現状把握
```bash
git log main..HEAD --oneline
git status
```
main ブランチからの差分コミットを一覧表示する。

### Step 2: 各コミットの内容確認
```bash
git show <commit> --stat
```
必要に応じて各コミットの変更内容を確認する。

### Step 3: 品質評価

以下の観点で評価する：

**メッセージの品質**
- Conventional Commits 形式（`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`）になっているか
- 英語で書かれているか
- 1行目が簡潔で内容を表しているか（50文字以内が理想）

**粒度**
- 1コミット = 1つの論理的な変更になっているか
- 「WIP」「fix typo」など、まとめるべき細かいコミットがないか
- 逆に、異なる目的の変更が1コミットに混在していないか

**順序**
- レビューしやすい順序になっているか

### Step 4: 方針の提示

評価結果と推奨アクションをユーザーに提示する。形式：

```
## コミット整理の方針

### 現在のコミット
1. abc1234 feat: add image preview
2. def5678 fix typo
3. ghi9012 WIP
4. jkl3456 fix: correct path handling

### 推奨アクション
- `def5678`（fix typo）と `ghi9012`（WIP）を `jkl3456` に squash
- メッセージを `fix: correct path handling and typos` に統一

### 実行する rebase 操作
[具体的な操作内容]

実行してよいですか？ (y/n)
```

### Step 5: ユーザー承認後に実行

承認が得られたら rebase を実行する。`git rebase -i` はインタラクティブモードが使えないため、`--autosquash` や個別の fixup コマンドを組み合わせて非インタラクティブに処理する。

```bash
GIT_SEQUENCE_EDITOR="..." git rebase -i main
```

rebase 失敗時は即座にユーザーに報告し、`git rebase --abort` を提案する。

### Step 6: 結果確認
```bash
git log main..HEAD --oneline
```
整理後の履歴を表示して完了を報告する。
