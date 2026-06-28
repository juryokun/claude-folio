use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

/// Priority order for status symbols (lower = shown when conflict with sibling)
fn symbol_priority(s: &str) -> u8 {
    match s {
        "U" => 0,
        "D" => 1,
        "M" => 2,
        "A" => 3,
        "?" => 4,
        "=" => 5, // clean — lowest priority
        _ => 9,
    }
}

fn derive_symbol(xy: &str) -> Option<&'static str> {
    let x = xy.chars().next().unwrap_or(' ');
    let y = xy.chars().nth(1).unwrap_or(' ');
    match (x, y) {
        ('?', '?') => Some("?"),
        ('!', '!') => None, // ignored — skip
        ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D') => Some("U"),
        _ if x == 'D' || y == 'D' => Some("D"),
        _ if x != ' ' && x != '?' && x != '!' => Some("M"),
        _ if y != ' ' && y != '?' && y != '!' => Some("M"),
        _ => None,
    }
}

fn merge_symbol(map: &mut HashMap<String, String>, name: String, symbol: &str) {
    let entry = map.entry(name).or_insert_with(|| symbol.to_string());
    if symbol_priority(symbol) < symbol_priority(entry) {
        *entry = symbol.to_string();
    }
}

/// Returns a map of filename (top-level entry in `path`) → status symbol.
///
/// Symbols:
///   `=`  clean (tracked, no changes)
///   `M`  modified
///   `A`  added/staged
///   `D`  deleted
///   `?`  untracked
///   `U`  unmerged/conflict
#[tauri::command]
pub fn get_git_status(path: String) -> HashMap<String, String> {
    // Resolve git root
    let root_out = Command::new("git")
        .args(["-C", &path, "rev-parse", "--show-toplevel"])
        .output();
    let Ok(root_out) = root_out else {
        return HashMap::new();
    };
    if !root_out.status.success() {
        return HashMap::new();
    }
    let git_root = String::from_utf8_lossy(&root_out.stdout)
        .trim()
        .to_string();

    let current = Path::new(&path);
    let root = Path::new(&git_root);
    let mut map: HashMap<String, String> = HashMap::new();

    // ── Step 1: mark all tracked direct children as clean ("=") ──────────────
    // `git ls-files` with -C outputs paths relative to <path>
    let ls_out = Command::new("git")
        .args(["-C", &path, "ls-files"])
        .output();
    if let Ok(ls_out) = ls_out {
        let text = String::from_utf8_lossy(&ls_out.stdout);
        for line in text.lines() {
            if let Some(first) = Path::new(line).components().next() {
                let name = first.as_os_str().to_string_lossy().to_string();
                map.entry(name).or_insert_with(|| "=".to_string());
            }
        }
    }

    // ── Step 2: overlay changed/untracked files (overrides "=") ──────────────
    let status_out = Command::new("git")
        .args(["-C", &path, "status", "--porcelain", "-u"])
        .output();
    let Ok(status_out) = status_out else {
        return map;
    };

    let text = String::from_utf8_lossy(&status_out.stdout);
    for line in text.lines() {
        if line.len() < 4 {
            continue;
        }
        let xy = &line[..2];
        let file_part = line[3..].trim();

        // Renames: "old -> new" — take destination
        let file = if xy.starts_with('R') || xy.starts_with('C') {
            file_part.split(" -> ").last().unwrap_or(file_part)
        } else {
            file_part
        };

        let Some(symbol) = derive_symbol(xy) else {
            continue;
        };

        let abs = root.join(file);
        let Ok(rel) = abs.strip_prefix(current) else {
            continue;
        };

        if let Some(first) = rel.components().next() {
            let name = first.as_os_str().to_string_lossy().to_string();
            merge_symbol(&mut map, name, symbol);
        }
    }

    map
}
