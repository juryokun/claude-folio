# Changelog

All notable changes to this project will be documented in this file.

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
