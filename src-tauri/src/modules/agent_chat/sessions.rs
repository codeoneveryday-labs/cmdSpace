pub(crate) use super::claude_turn::spawn_claude_turn;
pub(crate) use super::print_turn::spawn_print_turn;

/// A cancelled child exits non-successfully by design; only genuine failures
/// should become user-visible error events.
pub(crate) fn should_emit_exit_error(cancel_requested: bool, exit_success: bool) -> bool {
    !exit_success && !cancel_requested
}

#[cfg(test)]
mod tests {
    use super::should_emit_exit_error;

    #[test]
    fn cancel_suppresses_the_expected_exit_failure_error() {
        assert!(!should_emit_exit_error(true, false));
    }

    #[test]
    fn genuine_failures_still_emit_errors() {
        assert!(should_emit_exit_error(false, false));
    }

    #[test]
    fn successful_exits_never_emit_errors() {
        assert!(!should_emit_exit_error(false, true));
        assert!(!should_emit_exit_error(true, true));
    }
}
