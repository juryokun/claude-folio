# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2026-06-29

### Bug Fixes

- **Fixed zoxide not working inside the Tauri app** — On macOS, Tauri apps launch with a minimal system PATH (`/usr/bin:/bin`), so Homebrew-installed zoxide (`/opt/homebrew/bin/zoxide`) was not detected, causing the `z` key shortcut to stop working. The fix resolves the binary by checking known installation paths in order and caches the result at startup.

### Changes

- **App renamed** — `Claude Folio` → `Folio` (release build) / `Folio-dev` (dev build)
- **Dev build icon** — Dev builds now show a distinct icon with an orange DEV badge in the Dock, making it easy to tell apart from the release build.

## [0.2.0] - 2026-06-22

### Features

- Initial public release
