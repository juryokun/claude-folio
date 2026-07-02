use std::collections::HashMap;
use std::path::{Component, Path};
use std::process::Command;
use std::thread;

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

/// Skips `n` leading whitespace-separated fields and returns the trimmed remainder.
/// Used to jump to the (possibly space-containing) path column of a `status --porcelain=v2` line.
fn skip_fields(s: &str, n: usize) -> Option<&str> {
    let mut rest = s;
    for _ in 0..n {
        let trimmed = rest.trim_start();
        let idx = trimmed.find(char::is_whitespace)?;
        rest = &trimmed[idx..];
    }
    Some(rest.trim_start())
}

/// Parses one `git status --porcelain=v2` line into a (v1-style XY, path) pair.
/// Rename/copy lines keep only the destination path. Ignored (`!`) and unrecognized
/// lines return `None`.
fn parse_status_v2_line(line: &str) -> Option<(String, String)> {
    let kind = line.chars().next()?;
    match kind {
        '1' | '2' | 'u' => {
            let xy = skip_fields(line, 1)?.split_whitespace().next()?;
            let field_count = match kind {
                '1' => 8,
                '2' => 9,
                _ => 10,
            };
            let rest = skip_fields(line, field_count)?;
            let path = rest.split('\t').next()?;
            Some((xy.replace('.', " "), path.to_string()))
        }
        '?' => {
            let path = skip_fields(line, 1)?;
            Some(("??".to_string(), path.to_string()))
        }
        _ => None, // '!' (ignored) or unrecognized line kind
    }
}

/// Returns the first path component within `path`, or `None` if `path` escapes
/// the base directory (e.g. `../sibling.txt`, reported when a change lies outside
/// the `-C <path>` directory passed to git).
fn first_component_within(path: &str) -> Option<String> {
    match Path::new(path).components().next()? {
        Component::Normal(s) => Some(s.to_string_lossy().to_string()),
        _ => None,
    }
}

/// Parses `status --porcelain=v2` output and merges the resulting symbols into `map`.
fn merge_status_v2(map: &mut HashMap<String, String>, text: &str) {
    for line in text.lines() {
        let Some((xy, path)) = parse_status_v2_line(line) else {
            continue;
        };
        let Some(symbol) = derive_symbol(&xy) else {
            continue;
        };
        let Some(name) = first_component_within(&path) else {
            continue;
        };
        merge_symbol(map, name, symbol);
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
    // `ls-files` (for clean-file listing) and `status` (for changes) don't depend on
    // each other, so run them concurrently to cut wall-clock time roughly in half.
    let (ls_result, status_result) = thread::scope(|scope| {
        let ls_handle = scope.spawn(|| {
            Command::new("git")
                .args(["--no-optional-locks", "-C", &path, "ls-files"])
                .output()
        });
        let status_handle = scope.spawn(|| {
            Command::new("git")
                .args([
                    "--no-optional-locks",
                    "-C",
                    &path,
                    "-c",
                    "status.relativePaths=true",
                    "status",
                    "--porcelain=v2",
                    "--untracked-files=normal",
                ])
                .output()
        });
        (ls_handle.join(), status_handle.join())
    });

    let Ok(Ok(status_out)) = status_result else {
        return HashMap::new();
    };
    if !status_out.status.success() {
        return HashMap::new();
    }

    let mut map: HashMap<String, String> = HashMap::new();

    // ── Step 1: mark all tracked direct children as clean ("=") ──────────────
    // `git ls-files` with -C outputs paths relative to <path>
    // If this fails, unlike `status_out` above we don't bail out: clean files simply
    // won't get a "=" entry, but changed/untracked files from Step 2 are unaffected.
    if let Ok(Ok(ls_out)) = ls_result {
        let text = String::from_utf8_lossy(&ls_out.stdout);
        for line in text.lines() {
            if let Some(name) = first_component_within(line) {
                map.entry(name).or_insert_with(|| "=".to_string());
            }
        }
    }

    // ── Step 2: overlay changed/untracked files (overrides "=") ──────────────
    let text = String::from_utf8_lossy(&status_out.stdout);
    merge_status_v2(&mut map, &text);

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

    // ── skip_fields ──────────────────────────────────────────────────────────

    #[test]
    fn skip_fields_ordinary_entry_reaches_path() {
        let line = "1 .M N... 100644 100644 100644 aaa bbb deep/a.txt";
        assert_eq!(skip_fields(line, 8), Some("deep/a.txt"));
    }

    #[test]
    fn skip_fields_zero_returns_whole_trimmed_string() {
        assert_eq!(skip_fields("  a b c", 0), Some("a b c"));
    }

    #[test]
    fn skip_fields_too_many_returns_none() {
        assert_eq!(skip_fields("a b", 5), None);
    }

    // ── first_component_within ──────────────────────────────────────────────

    #[test]
    fn first_component_within_plain_file() {
        assert_eq!(first_component_within("a.txt"), Some("a.txt".to_string()));
    }

    #[test]
    fn first_component_within_nested_file_takes_top_dir() {
        assert_eq!(
            first_component_within("dir/nested.txt"),
            Some("dir".to_string())
        );
    }

    #[test]
    fn first_component_within_trailing_slash_dir() {
        // `--untracked-files=normal` reports untracked dirs as "name/"
        assert_eq!(
            first_component_within("untrackeddir/"),
            Some("untrackeddir".to_string())
        );
    }

    #[test]
    fn first_component_within_parent_dir_escape_is_none() {
        // Change lies outside the `-C <path>` directory passed to git
        assert_eq!(first_component_within("../sibling.txt"), None);
    }

    // ── parse_status_v2_line ─────────────────────────────────────────────────

    #[test]
    fn parse_status_v2_ordinary_modified() {
        let line = "1 .M N... 100644 100644 100644 aaa bbb deep/a.txt";
        assert_eq!(
            parse_status_v2_line(line),
            Some((" M".to_string(), "deep/a.txt".to_string()))
        );
    }

    #[test]
    fn parse_status_v2_rename_takes_destination_only() {
        let line = "2 R. N... 100644 100644 100644 aaa bbb R100 renamed.txt\tnested.txt";
        assert_eq!(
            parse_status_v2_line(line),
            Some(("R ".to_string(), "renamed.txt".to_string()))
        );
    }

    #[test]
    fn parse_status_v2_unmerged_conflict() {
        let line = "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.txt";
        assert_eq!(
            parse_status_v2_line(line),
            Some(("UU".to_string(), "conflict.txt".to_string()))
        );
    }

    #[test]
    fn parse_status_v2_untracked() {
        assert_eq!(
            parse_status_v2_line("? b.txt"),
            Some(("??".to_string(), "b.txt".to_string()))
        );
    }

    #[test]
    fn parse_status_v2_untracked_dir_with_trailing_slash() {
        assert_eq!(
            parse_status_v2_line("? untrackeddir/"),
            Some(("??".to_string(), "untrackeddir/".to_string()))
        );
    }

    #[test]
    fn parse_status_v2_ignored_returns_none() {
        assert_eq!(parse_status_v2_line("! ignored.txt"), None);
    }

    #[test]
    fn parse_status_v2_path_outside_base_dir() {
        let line = "1 .M N... 100644 100644 100644 aaa bbb ../a.txt";
        assert_eq!(
            parse_status_v2_line(line),
            Some((" M".to_string(), "../a.txt".to_string()))
        );
    }

    // ── merge_status_v2 ──────────────────────────────────────────────────────

    #[test]
    fn merge_status_v2_combines_multiple_lines() {
        let text =
            "1 .M N... 100644 100644 100644 aaa bbb a.txt\n? b.txt\n? untrackeddir/\n! ignored.txt";
        let mut map = HashMap::new();
        merge_status_v2(&mut map, text);
        assert_eq!(map.get("a.txt").map(String::as_str), Some("M"));
        assert_eq!(map.get("b.txt").map(String::as_str), Some("?"));
        assert_eq!(map.get("untrackeddir").map(String::as_str), Some("?"));
        assert_eq!(map.len(), 3);
    }

    #[test]
    fn merge_status_v2_filters_paths_outside_base_dir() {
        let text = "1 .M N... 100644 100644 100644 aaa bbb ../outside.txt";
        let mut map = HashMap::new();
        merge_status_v2(&mut map, text);
        assert!(map.is_empty());
    }

    // ── get_git_status (integration) ────────────────────────────────────────

    fn run_git(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(dir)
            .args(args)
            .status()
            .expect("failed to run git");
        assert!(status.success(), "git {:?} failed in {:?}", args, dir);
    }

    fn init_repo(dir: &Path) {
        run_git(dir, &["init", "-q"]);
        run_git(dir, &["config", "user.email", "test@example.com"]);
        run_git(dir, &["config", "user.name", "Test"]);
    }

    #[test]
    fn get_git_status_non_repo_returns_empty() {
        let dir = tempfile::TempDir::new().unwrap();
        let map = get_git_status(dir.path().to_string_lossy().to_string());
        assert!(map.is_empty());
    }

    #[test]
    fn get_git_status_reports_clean_modified_and_untracked() {
        let dir = tempfile::TempDir::new().unwrap();
        init_repo(dir.path());
        std::fs::write(dir.path().join("clean.txt"), "clean").unwrap();
        std::fs::write(dir.path().join("modme.txt"), "orig").unwrap();
        run_git(dir.path(), &["add", "clean.txt", "modme.txt"]);
        run_git(dir.path(), &["commit", "-q", "-m", "init"]);
        std::fs::write(dir.path().join("modme.txt"), "changed").unwrap();
        std::fs::write(dir.path().join("untracked.txt"), "new").unwrap();
        std::fs::create_dir(dir.path().join("untrackeddir")).unwrap();
        std::fs::write(dir.path().join("untrackeddir/f.txt"), "x").unwrap();

        let map = get_git_status(dir.path().to_string_lossy().to_string());

        assert_eq!(map.get("clean.txt").map(String::as_str), Some("="));
        assert_eq!(map.get("modme.txt").map(String::as_str), Some("M"));
        assert_eq!(map.get("untracked.txt").map(String::as_str), Some("?"));
        assert_eq!(map.get("untrackeddir").map(String::as_str), Some("?"));
    }

    #[test]
    fn get_git_status_reports_paths_relative_to_subdirectory() {
        // This is the core assumption of the current design: passing `-C <path>`
        // together with `-c status.relativePaths=true` makes git report paths
        // relative to `<path>`, not the repo root — even when `<path>` is a
        // subdirectory. Changes outside `<path>` (e.g. "../root_change.txt")
        // must be filtered out by `first_component_within`.
        let dir = tempfile::TempDir::new().unwrap();
        init_repo(dir.path());
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("tracked.txt"), "orig").unwrap();
        std::fs::write(dir.path().join("root_change.txt"), "orig").unwrap();
        run_git(dir.path(), &["add", "sub/tracked.txt", "root_change.txt"]);
        run_git(dir.path(), &["commit", "-q", "-m", "init"]);
        std::fs::write(sub.join("tracked.txt"), "changed").unwrap();
        std::fs::write(sub.join("untracked.txt"), "new").unwrap();
        std::fs::write(dir.path().join("root_change.txt"), "changed outside sub").unwrap();

        let map = get_git_status(sub.to_string_lossy().to_string());

        assert_eq!(map.get("tracked.txt").map(String::as_str), Some("M"));
        assert_eq!(map.get("untracked.txt").map(String::as_str), Some("?"));
        assert!(!map.contains_key("root_change.txt"));
    }

    #[test]
    fn get_git_status_works_through_symlinked_path() {
        // Regression test: the previous implementation resolved the git root via
        // `rev-parse --show-toplevel` (which canonicalizes symlinks) and then
        // stripped it from the caller-supplied `path` (not canonicalized). On a
        // symlinked path the strip_prefix silently failed and returned an empty
        // map. The current implementation never canonicalizes, so it must work.
        let real_dir = tempfile::TempDir::new().unwrap();
        init_repo(real_dir.path());
        std::fs::write(real_dir.path().join("a.txt"), "orig").unwrap();
        run_git(real_dir.path(), &["add", "a.txt"]);
        run_git(real_dir.path(), &["commit", "-q", "-m", "init"]);
        std::fs::write(real_dir.path().join("a.txt"), "changed").unwrap();

        let link_path = real_dir.path().with_extension("link");
        std::os::unix::fs::symlink(real_dir.path(), &link_path).unwrap();

        let map = get_git_status(link_path.to_string_lossy().to_string());
        std::fs::remove_file(&link_path).unwrap();

        assert_eq!(map.get("a.txt").map(String::as_str), Some("M"));
    }
}
