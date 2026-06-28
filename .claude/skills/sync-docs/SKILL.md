---
name: sync-docs
description: docs/ 配下の Markdown とダイアグラムを現在のコードに合わせて更新する。アーキテクチャレベルの変更後や、ドキュメントが古くなったと感じたときに使う。
user-invocable: true
allowed-tools:
  - Bash(git diff *)
  - Bash(git log *)
---

# /sync-docs

document エージェントを起動して `docs/` を最新の状態に更新する。

## 実行手順

### 1. 変更範囲の把握
```bash
git diff HEAD~1 --name-only
git log --oneline -5
```
直近の変更からドキュメントへの影響範囲を特定する。

### 2. document エージェントに委譲
以下の情報を document エージェントに渡して起動する：
- 変更されたファイル一覧
- 変更の概要（何を追加・変更したか）
- 更新が必要と思われるドキュメント

document エージェントは `docs/` の Markdown 更新とダイアグラム（`.d2` → `.svg`）再生成を行う。

### 3. 完了報告
更新されたファイルの一覧と変更概要をユーザーに報告する。
