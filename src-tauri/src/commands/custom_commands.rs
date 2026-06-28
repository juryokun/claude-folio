use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OutputMode {
    Auto,
    Modal,
}

impl Default for OutputMode {
    fn default() -> Self { OutputMode::Auto }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomCommand {
    pub name: String,
    #[serde(default)]
    pub desc: String,
    pub command: String,
    #[serde(default)]
    pub shell: String,
    #[serde(default)]
    pub reload: bool,
    #[serde(default)]
    pub confirm: bool,
    #[serde(default)]
    pub output: OutputMode,
}

#[derive(Debug, Deserialize, Default)]
struct CommandsFile {
    #[serde(default)]
    commands: Vec<CustomCommand>,
}

#[derive(Debug, Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

fn commands_path() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        PathBuf::from(h)
            .join(".config")
            .join("folio")
            .join("commands.toml")
    })
}

pub(crate) fn load_custom_commands_from(path: &std::path::Path) -> Vec<CustomCommand> {
    let Ok(content) = std::fs::read_to_string(path) else {
        return vec![];
    };
    toml::from_str::<CommandsFile>(&content)
        .unwrap_or_else(|e| {
            eprintln!("[folio] commands.toml parse error: {e}");
            CommandsFile::default()
        })
        .commands
}

#[tauri::command]
pub fn load_custom_commands() -> Vec<CustomCommand> {
    let Some(path) = commands_path() else {
        return vec![];
    };
    load_custom_commands_from(&path)
}

fn resolve_shell(shell: &str) -> String {
    if !shell.is_empty() {
        return shell.to_string();
    }
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

fn shell_args(shell: &str, command: &str) -> Vec<String> {
    let name = std::path::Path::new(shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    match name {
        "fish" => vec!["--command".to_string(), command.to_string()],
        _ => vec!["-c".to_string(), command.to_string()],
    }
}

#[tauri::command]
pub fn run_shell_command(shell: String, command: String, cwd: String) -> Result<ShellOutput, String> {
    let shell_bin = resolve_shell(&shell);
    let args = shell_args(&shell_bin, &command);

    let output = std::process::Command::new(&shell_bin)
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to run shell: {e}"))?;

    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_commands(dir: &TempDir, content: &str) -> std::path::PathBuf {
        let path = dir.path().join("commands.toml");
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn load_from_nonexistent_returns_empty() {
        let dir = TempDir::new().unwrap();
        let cmds = load_custom_commands_from(&dir.path().join("none.toml"));
        assert!(cmds.is_empty());
    }

    #[test]
    fn load_minimal_command() {
        let dir = TempDir::new().unwrap();
        let path = write_commands(&dir, r#"
[[commands]]
name = "hello"
command = "echo hello"
"#);
        let cmds = load_custom_commands_from(&path);
        assert_eq!(cmds.len(), 1);
        assert_eq!(cmds[0].name, "hello");
        assert_eq!(cmds[0].command, "echo hello");
        assert!(!cmds[0].reload);
        assert!(!cmds[0].confirm);
    }

    #[test]
    fn load_full_command() {
        let dir = TempDir::new().unwrap();
        let path = write_commands(&dir, r#"
[[commands]]
name = "cleanup"
desc = "Remove temp files"
command = "rm -f {dir}/*.tmp"
shell = "/bin/bash"
reload = true
confirm = true
output = "modal"
"#);
        let cmds = load_custom_commands_from(&path);
        assert_eq!(cmds[0].desc, "Remove temp files");
        assert_eq!(cmds[0].shell, "/bin/bash");
        assert!(cmds[0].reload);
        assert!(cmds[0].confirm);
        assert_eq!(cmds[0].output, OutputMode::Modal);
    }

    #[test]
    fn output_defaults_to_auto() {
        let dir = TempDir::new().unwrap();
        let path = write_commands(&dir, r#"
[[commands]]
name = "hello"
command = "echo hello"
"#);
        let cmds = load_custom_commands_from(&path);
        assert_eq!(cmds[0].output, OutputMode::Auto);
    }

    #[test]
    fn load_multiple_commands() {
        let dir = TempDir::new().unwrap();
        let path = write_commands(&dir, r#"
[[commands]]
name = "a"
command = "echo a"

[[commands]]
name = "b"
command = "echo b"
"#);
        let cmds = load_custom_commands_from(&path);
        assert_eq!(cmds.len(), 2);
        assert_eq!(cmds[0].name, "a");
        assert_eq!(cmds[1].name, "b");
    }

    #[test]
    fn load_invalid_toml_returns_empty() {
        let dir = TempDir::new().unwrap();
        let path = write_commands(&dir, "NOT VALID TOML :::");
        let cmds = load_custom_commands_from(&path);
        assert!(cmds.is_empty());
    }

    #[test]
    fn shell_args_uses_c_for_bash() {
        let args = shell_args("/bin/bash", "echo hi");
        assert_eq!(args, vec!["-c", "echo hi"]);
    }

    #[test]
    fn shell_args_uses_command_for_fish() {
        let args = shell_args("/usr/local/bin/fish", "echo hi");
        assert_eq!(args, vec!["--command", "echo hi"]);
    }

    #[test]
    fn run_shell_command_echo() {
        let dir = TempDir::new().unwrap();
        let out = run_shell_command(
            "/bin/sh".to_string(),
            "echo hello".to_string(),
            dir.path().to_string_lossy().to_string(),
        ).unwrap();
        assert_eq!(out.stdout.trim(), "hello");
        assert_eq!(out.exit_code, 0);
    }

    #[test]
    fn run_shell_command_failure_exit_code() {
        let dir = TempDir::new().unwrap();
        let out = run_shell_command(
            "/bin/sh".to_string(),
            "exit 42".to_string(),
            dir.path().to_string_lossy().to_string(),
        ).unwrap();
        assert_eq!(out.exit_code, 42);
    }
}
