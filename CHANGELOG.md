# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-07-02

### Features

- **Recent files/directories history** — Press `fr` to open a searchable history of recently opened files and directories, showing access time and modification date. Selecting a file jumps to its parent directory and focuses it; selecting a directory navigates there directly.
- **Highlight staged files** — Files staged for copy or cut now get a dashed outline in the file list, with cut files additionally dimmed, so it's clear at a glance what's queued for a paste.

### Bug Fixes

- **Find mode results across tabs** — Switching tabs no longer clears active find-mode search results; they now persist until you navigate within the tab.
- **Blank file list after navigation** — Fixed the file list occasionally rendering blank at the top after navigating, caused by a stale scroll position carried over from the previous directory.
- **Find mode row overlap** — Increased row height in find mode so the filename and parent path lines no longer overlap.

### Performance

- **Faster git status** — Git status now runs its underlying git calls in parallel and avoids an extra process spawn per directory, speeding up directory loads in git repos. This also fixes an issue where opening a symlinked path (e.g. under /tmp) would silently show no git status.

## [0.2.3] - 2026-06-30

### Features

- **Zoxide path display** — Zoxide jump candidates now show the directory basename with an abbreviated parent path, making it easier to distinguish similar directories at a glance.

## [0.2.2] - 2026-06-29

### Bug Fixes

- **Path bar truncation** — Deep paths with more than 4 segments are now shown as `… / parent / child / current` instead of overflowing the toolbar.
- **Shell injection prevention** — File paths containing spaces or special characters no longer cause issues when opening a terminal at the current directory.
- **Watcher stability** — Fixed a potential panic when the file-system watcher encountered a poisoned lock.

### Performance

- **Faster cursor movement** — Applied fine-grained Zustand subscriptions (`useShallow`) to eliminate unnecessary re-renders when moving the cursor in the file pane.
- **Preview panel debounce** — File preview requests are now debounced by 150 ms, reducing redundant Rust calls during fast cursor movement.

## [0.2.1] - 2026-06-29

### Bug Fixes

- **Fixed zoxide not working inside the Tauri app** — On macOS, Tauri apps launch with a minimal system PATH (`/usr/bin:/bin`), so Homebrew-installed zoxide (`/opt/homebrew/bin/zoxide`) was not detected, causing the `z` key shortcut to stop working. The fix resolves the binary by checking known installation paths in order and caches the result at startup.

### Changes

- **App renamed** — `Claude Folio` → `Folio` (release build) / `Folio-dev` (dev build)
- **Dev build icon** — Dev builds now show a distinct icon with an orange DEV badge in the Dock, making it easy to tell apart from the release build.

## [0.2.0] - 2026-06-22

### Features

- Initial public release
