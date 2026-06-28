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
    let git_root = String::from_utf8_lossy(&root_out.stdout).trim().to_string();

    let current = Path::new(&path);
    let root = Path::new(&git_root);
    let mut map: HashMap<String, String> = HashMap::new();

    // ── Step 1: mark all tracked direct children as clean ("=") ──────────────
    // `git ls-files` with -C outputs paths relative to <path>
    let ls_out = Command::new("git").args(["-C", &path, "ls-files"]).output();
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── symbol_priority ──────────────────────────────────────────────────────

    #[test]
    fn symbol_priority_full_order() {
        let ordered = ["U", "D", "M", "A", "?", "="];
        for i in 0..ordered.len() - 1 {
            assert!(
                symbol_priority(ordered[i]) < symbol_priority(ordered[i + 1]),
                "{} should have lower priority number than {}",
                ordered[i],
                ordered[i + 1]
            );
        }
    }

    #[test]
    fn symbol_priority_unknown_returns_9() {
        assert_eq!(symbol_priority("X"), 9);
        assert_eq!(symbol_priority(""), 9);
    }

    // ── derive_symbol ────────────────────────────────────────────────────────

    #[test]
    fn derive_symbol_untracked_is_question_mark() {
        assert_eq!(derive_symbol("??"), Some("?"));
    }

    #[test]
    fn derive_symbol_ignored_returns_none() {
        assert_eq!(derive_symbol("!!"), None);
    }

    #[test]
    fn derive_symbol_unmerged_uu() {
        assert_eq!(derive_symbol("UU"), Some("U"));
    }

    #[test]
    fn derive_symbol_unmerged_u_prefix() {
        assert_eq!(derive_symbol("U "), Some("U"));
    }

    #[test]
    fn derive_symbol_unmerged_u_suffix() {
        assert_eq!(derive_symbol(" U"), Some("U"));
    }

    #[test]
    fn derive_symbol_both_added_is_unmerged() {
        // git porcelain "AA" = both sides added (merge conflict)
        assert_eq!(derive_symbol("AA"), Some("U"));
    }

    #[test]
    fn derive_symbol_both_deleted_is_unmerged() {
        // git porcelain "DD" = both sides deleted (merge conflict)
        assert_eq!(derive_symbol("DD"), Some("U"));
    }

    #[test]
    fn derive_symbol_staged_deletion_is_d() {
        assert_eq!(derive_symbol("D "), Some("D"));
    }

    #[test]
    fn derive_symbol_worktree_deletion_is_d() {
        assert_eq!(derive_symbol(" D"), Some("D"));
    }

    #[test]
    fn derive_symbol_staged_modification_is_m() {
        assert_eq!(derive_symbol("M "), Some("M"));
    }

    #[test]
    fn derive_symbol_worktree_modification_is_m() {
        assert_eq!(derive_symbol(" M"), Some("M"));
    }

    #[test]
    fn derive_symbol_both_modified_is_m() {
        assert_eq!(derive_symbol("MM"), Some("M"));
    }

    #[test]
    fn derive_symbol_staged_addition_is_m() {
        // x='A', y=' ': staged new file shows as M (modified index)
        assert_eq!(derive_symbol("A "), Some("M"));
    }

    #[test]
    fn derive_symbol_rename_staged_is_m() {
        assert_eq!(derive_symbol("R "), Some("M"));
    }

    #[test]
    fn derive_symbol_clean_returns_none() {
        assert_eq!(derive_symbol("  "), None);
    }

    // ── merge_symbol ─────────────────────────────────────────────────────────

    #[test]
    fn merge_symbol_inserts_new_entry() {
        let mut map = HashMap::new();
        merge_symbol(&mut map, "file.rs".to_string(), "M");
        assert_eq!(map.get("file.rs").map(String::as_str), Some("M"));
    }

    #[test]
    fn merge_symbol_higher_priority_replaces_existing() {
        // U(0) beats M(2) because lower number = higher priority
        let mut map = HashMap::new();
        merge_symbol(&mut map, "file.rs".to_string(), "M");
        merge_symbol(&mut map, "file.rs".to_string(), "U");
        assert_eq!(map.get("file.rs").map(String::as_str), Some("U"));
    }

    #[test]
    fn merge_symbol_lower_priority_does_not_replace() {
        // =(5) cannot displace U(0)
        let mut map = HashMap::new();
        merge_symbol(&mut map, "file.rs".to_string(), "U");
        merge_symbol(&mut map, "file.rs".to_string(), "=");
        assert_eq!(map.get("file.rs").map(String::as_str), Some("U"));
    }

    #[test]
    fn merge_symbol_equal_or_lower_priority_keeps_first() {
        // M(2) already set; A(3) is lower priority, so M stays
        let mut map = HashMap::new();
        merge_symbol(&mut map, "file.rs".to_string(), "M");
        merge_symbol(&mut map, "file.rs".to_string(), "A");
        assert_eq!(map.get("file.rs").map(String::as_str), Some("M"));
    }

    #[test]
    fn merge_symbol_multiple_files_independent() {
        let mut map = HashMap::new();
        merge_symbol(&mut map, "a.rs".to_string(), "M");
        merge_symbol(&mut map, "b.rs".to_string(), "U");
        // Try to downgrade a.rs — M(2) beats =(5), so M stays
        merge_symbol(&mut map, "a.rs".to_string(), "=");
        assert_eq!(map.get("a.rs").map(String::as_str), Some("M"));
        assert_eq!(map.get("b.rs").map(String::as_str), Some("U"));
    }
}
