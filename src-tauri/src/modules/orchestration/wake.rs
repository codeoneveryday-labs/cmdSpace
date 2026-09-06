use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Nudge typed into an idle worker's PTY when it holds undrained inbox mail.
/// Names no specific message: the inbox directory is authoritative and the
/// agent may already have drained the mail that triggered the wake.
pub const WAKE_NUDGE: &str = "You have new inbox message(s) — read your inbox, act on what is pending there, and move handled ones to inbox/.done/. Act autonomously; only message the orchestrator if you genuinely need a decision.";

/// No PTY output for this long means genuinely idle, never mid-turn.
pub const WAKE_IDLE_MS: u64 = 12_000;
/// Never nudge inside the boot sequence after spawn.
pub const WAKE_BOOT_GRACE_MS: u64 = 35_000;
/// Minimum gap between two nudges of the same worker.
pub const WAKE_COOLDOWN_MS: u64 = 60_000;
/// A permission/HITL notification blocks nudges for this long after it fires,
/// so a prompt the human is deciding on is never typed into.
pub const WAKE_HITL_REARM_MS: u64 = 5 * 60_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HookClass {
    NeedsHuman,
    Idle,
}

pub fn classify_hook(event: Option<&str>, message: Option<&str>) -> Option<HookClass> {
    if event != Some("Notification") {
        return None;
    }
    let text = message.unwrap_or_default().to_lowercase();
    let idle_waiting =
        text.is_empty() || text.contains("waiting for your input") || text.contains("is idle");
    let needs_human =
        text.contains("permission") || text.contains("approve") || text.contains("needs your");
    if needs_human && !idle_waiting {
        Some(HookClass::NeedsHuman)
    } else {
        Some(HookClass::Idle)
    }
}

/// One worker's live facts, gathered by the caller each beat.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct WakeFacts {
    pub agent_id: String,
    pub is_orchestrator: bool,
    pub pty_id: Option<String>,
    pub last_output_at: u64,
    pub inbox_count: u32,
    pub delivery_paused: bool,
    pub paused: bool,
    pub halted: bool,
}

/// A decided wake-up: which PTY to type what into. The caller types
/// `nudge` into the worker's terminal, then presses Enter separately.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeCandidate {
    pub agent_id: String,
    pub nudge: String,
}

/// Inbox-wake watchdog policy. Pure decision core: the caller gathers facts
/// and types the nudge. No PTY or Tauri imports — unit-testable in isolation.
/// Live wiring (last-output timestamps, agent-to-PTY binding, periodic beat)
/// is a follow-up; see the mailbox-router execution plan.
#[derive(Default)]
pub struct WakeWatchdog {
    spawned_at: HashMap<String, u64>,
    last_nudge_at: HashMap<String, u64>,
    last_human_needs_at: HashMap<String, u64>,
}

impl WakeWatchdog {
    /// Record a PTY spawn so its boot sequence is left alone.
    pub fn note_spawn(&mut self, pty_id: &str, at: u64) {
        self.spawned_at.insert(pty_id.to_string(), at);
    }

    /// Feed hook events so a HITL prompt blocks nudges.
    pub fn note_hook(
        &mut self,
        agent_id: &str,
        event: Option<&str>,
        message: Option<&str>,
        at: u64,
    ) {
        if classify_hook(event, message) == Some(HookClass::NeedsHuman) {
            self.last_human_needs_at.insert(agent_id.to_string(), at);
        }
    }

    /// Forget per-agent state (e.g. the agent's PTY was closed).
    pub fn forget(&mut self, agent_id: &str, pty_id: Option<&str>) {
        self.last_nudge_at.remove(agent_id);
        self.last_human_needs_at.remove(agent_id);
        if let Some(pty_id) = pty_id {
            self.spawned_at.remove(pty_id);
        }
    }

    /// The worker ids that should be nudged right now, in input order.
    pub fn decide(&mut self, facts: &[WakeFacts], now: u64) -> Vec<String> {
        let mut out = Vec::new();
        for worker in facts {
            if worker.is_orchestrator || worker.inbox_count == 0 {
                continue;
            }
            let Some(pty_id) = worker.pty_id.as_deref() else {
                continue;
            };
            if worker.delivery_paused || worker.paused || worker.halted {
                continue;
            }
            if worker.last_output_at == 0
                || now.saturating_sub(worker.last_output_at) < WAKE_IDLE_MS
            {
                continue;
            }
            if let Some(spawned) = self.spawned_at.get(pty_id) {
                if now.saturating_sub(*spawned) < WAKE_BOOT_GRACE_MS {
                    continue;
                }
            }
            if let Some(last_human) = self.last_human_needs_at.get(&worker.agent_id) {
                if now.saturating_sub(*last_human) < WAKE_HITL_REARM_MS {
                    continue;
                }
            }
            if let Some(last_nudge) = self.last_nudge_at.get(&worker.agent_id) {
                if now.saturating_sub(*last_nudge) < WAKE_COOLDOWN_MS {
                    continue;
                }
            }
            self.last_nudge_at.insert(worker.agent_id.clone(), now);
            out.push(worker.agent_id.clone());
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_hook, HookClass, WakeFacts, WakeWatchdog, WAKE_COOLDOWN_MS, WAKE_HITL_REARM_MS,
        WAKE_IDLE_MS, WAKE_NUDGE,
    };

    fn facts(agent_id: &str) -> WakeFacts {
        WakeFacts {
            agent_id: agent_id.to_string(),
            is_orchestrator: false,
            pty_id: Some("pty-1".to_string()),
            last_output_at: 100_000,
            inbox_count: 2,
            delivery_paused: false,
            paused: false,
            halted: false,
        }
    }

    #[test]
    fn nudge_names_the_inbox_contract_without_listing_messages() {
        assert!(WAKE_NUDGE.contains("inbox/.done/"));
        assert!(WAKE_NUDGE.contains("orchestrator"));
    }

    #[test]
    fn hook_classifier_separates_hitl_prompts_from_idle_waiting() {
        assert_eq!(
            classify_hook(Some("Notification"), Some("Need permission to edit")),
            Some(HookClass::NeedsHuman)
        );
        assert_eq!(
            classify_hook(Some("Notification"), Some("Waiting for your input")),
            Some(HookClass::Idle)
        );
        assert_eq!(
            classify_hook(Some("Notification"), None),
            Some(HookClass::Idle)
        );
        assert_eq!(classify_hook(Some("Stop"), None), None);
        assert_eq!(classify_hook(None, None), None);
    }

    #[test]
    fn idle_worker_with_mail_is_nudged_once_per_cooldown() {
        let mut watchdog = WakeWatchdog::default();
        let now = 100_000 + WAKE_IDLE_MS;
        assert_eq!(watchdog.decide(&[facts("builder")], now), vec!["builder"]);
        assert!(watchdog.decide(&[facts("builder")], now + 1).is_empty());
        assert_eq!(
            watchdog.decide(&[facts("builder")], now + WAKE_COOLDOWN_MS),
            vec!["builder"]
        );
    }

    #[test]
    fn orchestrator_paused_halted_ptyless_and_mail_less_workers_are_skipped() {
        let mut watchdog = WakeWatchdog::default();
        let now = 100_000 + WAKE_IDLE_MS;
        let mut god = facts("boss");
        god.is_orchestrator = true;
        let mut paused = facts("paused");
        paused.paused = true;
        let mut halted = facts("halted");
        halted.halted = true;
        let mut held = facts("held");
        held.delivery_paused = true;
        let mut ptyless = facts("ptyless");
        ptyless.pty_id = None;
        let mut empty = facts("empty");
        empty.inbox_count = 0;
        let workers = vec![god, paused, halted, held, ptyless, empty];
        assert!(watchdog.decide(&workers, now).is_empty());
    }

    #[test]
    fn mid_turn_booting_and_hitl_blocked_workers_are_skipped() {
        let mut watchdog = WakeWatchdog::default();
        watchdog.note_spawn("pty-1", 190_000);
        let now = 200_000;
        assert!(watchdog.decide(&[facts("builder")], now).is_empty());

        let mut watchdog = WakeWatchdog::default();
        let mut busy = facts("builder");
        busy.last_output_at = now;
        assert!(watchdog.decide(&[busy], now + WAKE_IDLE_MS - 1).is_empty());

        let mut watchdog = WakeWatchdog::default();
        watchdog.note_hook("builder", Some("Notification"), Some("Approve this?"), now);
        assert!(watchdog
            .decide(&[facts("builder")], now + WAKE_IDLE_MS)
            .is_empty());
        assert_eq!(
            watchdog.decide(&[facts("builder")], now + WAKE_HITL_REARM_MS + WAKE_IDLE_MS),
            vec!["builder"]
        );
    }

    #[test]
    fn forget_clears_boot_state() {
        let mut watchdog = WakeWatchdog::default();
        watchdog.note_spawn("pty-1", 190_000);
        let now = 200_000;
        assert!(watchdog.decide(&[facts("builder")], now).is_empty());
        watchdog.forget("builder", Some("pty-1"));
        assert_eq!(watchdog.decide(&[facts("builder")], now), vec!["builder"]);
    }
}
