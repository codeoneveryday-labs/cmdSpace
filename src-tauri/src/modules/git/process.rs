#[path = "process_availability.rs"]
mod availability;
#[path = "process_output.rs"]
mod output;
#[path = "process_runner.rs"]
mod runner;
pub use availability::ensure_git_available;
pub use output::{
    ensure_success, git_show_text, git_stdout_line_opt, git_stdout_lines, read_text_file,
};
#[cfg(windows)]
pub use runner::build_git_command;
pub use runner::run_git;
