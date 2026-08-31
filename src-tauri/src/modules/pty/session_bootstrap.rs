const PROMPT_READY_MARKER: &[u8] = b"\x1b]133;A\x1b\\";

pub(super) struct InitialCommandBootstrap {
    command: Option<String>,
    marker_tail: Vec<u8>,
}

impl InitialCommandBootstrap {
    pub(super) fn new(command: Option<String>) -> Self {
        Self {
            command: command.filter(|command| !command.trim().is_empty()),
            marker_tail: Vec::with_capacity(PROMPT_READY_MARKER.len() - 1),
        }
    }

    pub(super) fn take_when_prompt_ready(&mut self, bytes: &[u8]) -> Option<String> {
        self.command.as_ref()?;
        self.marker_tail.extend_from_slice(bytes);
        if self
            .marker_tail
            .windows(PROMPT_READY_MARKER.len())
            .any(|window| window == PROMPT_READY_MARKER)
        {
            self.marker_tail.clear();
            return self.command.take();
        }
        let tail_length = PROMPT_READY_MARKER.len() - 1;
        if self.marker_tail.len() > tail_length {
            let start = self.marker_tail.len() - tail_length;
            self.marker_tail.drain(..start);
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::InitialCommandBootstrap;

    #[test]
    fn initial_command_waits_for_a_prompt_marker_split_across_chunks() {
        let mut bootstrap = InitialCommandBootstrap::new(Some("codex".into()));

        assert_eq!(bootstrap.take_when_prompt_ready(b"boot\x1b]133;"), None);
        assert_eq!(
            bootstrap.take_when_prompt_ready(b"A\x1b\\prompt"),
            Some("codex".into())
        );
    }

    #[test]
    fn initial_command_runs_only_once() {
        let mut bootstrap = InitialCommandBootstrap::new(Some("codex".into()));

        assert_eq!(
            bootstrap.take_when_prompt_ready(b"\x1b]133;A\x1b\\"),
            Some("codex".into())
        );
        assert_eq!(bootstrap.take_when_prompt_ready(b"\x1b]133;A\x1b\\"), None);
    }
}
