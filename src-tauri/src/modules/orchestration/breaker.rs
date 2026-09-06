use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BreakerLevel {
    Healthy,
    Steering,
    Constrained,
    Stopped,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BreakerAction {
    None,
    Steer,
    Constrain,
    Stop,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakerState {
    pub agent_id: String,
    pub level: BreakerLevel,
    pub reason: String,
    pub ts: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakerDecision {
    pub state: BreakerState,
    pub action: BreakerAction,
    pub changed: bool,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakerSample {
    pub input: u64,
    pub output: u64,
    pub errors: u32,
    pub repeat_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakerInput {
    pub agent_id: String,
    pub sample: Option<BreakerSample>,
    pub progressing: bool,
}

#[derive(Clone, Debug)]
pub struct BreakerConfig {
    pub repeated_tool_limit: u32,
    pub error_storm_limit: u32,
    pub agent_token_cap: Option<u64>,
    pub enabled: bool,
    pub hard_stop: bool,
}

impl Default for BreakerConfig {
    fn default() -> Self {
        Self {
            repeated_tool_limit: 8,
            error_storm_limit: 5,
            agent_token_cap: None,
            enabled: true,
            hard_stop: false,
        }
    }
}

#[derive(Clone, Debug, Default)]
struct AgentTrack {
    level: Option<BreakerLevel>,
    reason: String,
    repeat_key: Option<String>,
    repeat_count: u32,
    error_count: u32,
    no_progress_beats: u32,
}

#[derive(Default)]
pub struct CircuitBreaker {
    tracks: HashMap<String, AgentTrack>,
}

impl CircuitBreaker {
    fn ceiling(config: &BreakerConfig) -> BreakerLevel {
        if config.hard_stop {
            BreakerLevel::Stopped
        } else {
            BreakerLevel::Constrained
        }
    }

    fn one_above(level: BreakerLevel) -> BreakerLevel {
        match level {
            BreakerLevel::Healthy => BreakerLevel::Steering,
            BreakerLevel::Steering => BreakerLevel::Constrained,
            BreakerLevel::Constrained | BreakerLevel::Stopped => BreakerLevel::Stopped,
        }
    }

    fn one_below(level: BreakerLevel) -> BreakerLevel {
        match level {
            BreakerLevel::Healthy | BreakerLevel::Steering => BreakerLevel::Healthy,
            BreakerLevel::Constrained => BreakerLevel::Steering,
            BreakerLevel::Stopped => BreakerLevel::Constrained,
        }
    }

    fn action_for(level: BreakerLevel, escalated: bool) -> BreakerAction {
        if !escalated {
            return BreakerAction::None;
        }
        match level {
            BreakerLevel::Healthy => BreakerAction::None,
            BreakerLevel::Steering => BreakerAction::Steer,
            BreakerLevel::Constrained => BreakerAction::Constrain,
            BreakerLevel::Stopped => BreakerAction::Stop,
        }
    }

    pub fn tick(
        &mut self,
        config: &BreakerConfig,
        input: &BreakerInput,
        now: i64,
    ) -> BreakerDecision {
        let now = now.max(0) as u64;
        let track = self.tracks.entry(input.agent_id.clone()).or_default();
        let current = track.level.unwrap_or(BreakerLevel::Healthy);
        if !config.enabled {
            return BreakerDecision {
                state: BreakerState {
                    agent_id: input.agent_id.clone(),
                    level: BreakerLevel::Healthy,
                    reason: String::new(),
                    ts: now,
                },
                action: BreakerAction::None,
                changed: current != BreakerLevel::Healthy,
            };
        }

        let mut trip: Option<(BreakerLevel, String)> = None;
        if let Some(sample) = &input.sample {
            let key = sample.repeat_key.clone().unwrap_or_default();
            if Some(&key) == track.repeat_key.as_ref() {
                track.repeat_count += 1;
            } else {
                track.repeat_key = Some(key);
                track.repeat_count = 1;
                track.error_count = 0;
            }
            if track.repeat_count >= config.repeated_tool_limit.max(1) {
                trip = Some((
                    BreakerLevel::Steering,
                    format!("looping: {}x identical tool call", track.repeat_count),
                ));
            }
            track.error_count = track.error_count.saturating_add(sample.errors);
            if trip.is_none() && track.error_count >= config.error_storm_limit.max(1) {
                trip = Some((
                    BreakerLevel::Constrained,
                    format!("error storm: {} consecutive errors", track.error_count),
                ));
            }
            if trip.is_none() {
                if let Some(cap) = config.agent_token_cap {
                    if sample.input.saturating_add(sample.output) > cap {
                        trip = Some((
                            BreakerLevel::Constrained,
                            format!("token limit: over {cap}"),
                        ));
                    }
                }
            }
            if trip.is_none() && !input.progressing {
                track.no_progress_beats += 1;
                if track.no_progress_beats >= 2 {
                    trip = Some((
                        BreakerLevel::Steering,
                        "no-progress: generating tokens without coordinating".to_string(),
                    ));
                }
            } else if trip.is_none() {
                track.no_progress_beats = 0;
            }
        }

        let ceiling = Self::ceiling(config);
        let next = match &trip {
            Some(_) => Self::one_above(current).min(ceiling),
            None => Self::one_below(current),
        };
        let changed = next != current;
        let escalated = next > current;
        let reason = match &trip {
            Some((_, reason)) if changed || next != BreakerLevel::Healthy => reason.clone(),
            _ if changed && next == BreakerLevel::Healthy => {
                "recovering — signals cleared".to_string()
            }
            _ => track.reason.clone(),
        };
        track.level = Some(next);
        if changed || !reason.is_empty() {
            track.reason = reason.clone();
        }
        BreakerDecision {
            state: BreakerState {
                agent_id: input.agent_id.clone(),
                level: next,
                reason,
                ts: now,
            },
            action: Self::action_for(next, escalated),
            changed,
        }
    }

    #[allow(dead_code)]
    pub fn forget(&mut self, agent_id: &str) {
        self.tracks.remove(agent_id);
    }

    pub fn level_for(&self, agent_id: &str) -> BreakerLevel {
        self.tracks
            .get(agent_id)
            .and_then(|track| track.level)
            .unwrap_or(BreakerLevel::Healthy)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BreakerAction, BreakerConfig, BreakerInput, BreakerLevel, BreakerSample, CircuitBreaker,
    };

    fn input(agent_id: &str) -> BreakerInput {
        BreakerInput {
            agent_id: agent_id.to_string(),
            sample: None,
            progressing: true,
        }
    }

    fn sample(agent_id: &str, key: &str) -> BreakerInput {
        BreakerInput {
            agent_id: agent_id.to_string(),
            sample: Some(BreakerSample {
                input: 10,
                output: 20,
                errors: 0,
                repeat_key: Some(key.to_string()),
            }),
            progressing: true,
        }
    }

    #[test]
    fn disabled_breaker_stays_healthy() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig {
            enabled: false,
            ..BreakerConfig::default()
        };
        let decision = breaker.tick(&config, &sample("builder", "k"), 1);
        assert_eq!(decision.state.level, BreakerLevel::Healthy);
        assert_eq!(decision.action, BreakerAction::None);
    }

    #[test]
    fn loop_trips_to_steering_one_level_per_tick() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig::default();
        let mut last = breaker.tick(&config, &sample("builder", "k"), 1);
        for now in 2..=8 {
            last = breaker.tick(&config, &sample("builder", "k"), now);
        }
        assert_eq!(last.state.level, BreakerLevel::Steering);
        assert_eq!(last.action, BreakerAction::Steer);
        assert!(last.changed);
        assert!(last.state.reason.contains("looping"));
    }

    #[test]
    fn error_storm_escalates_one_level_per_beat() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig::default();
        let storm = BreakerInput {
            sample: Some(BreakerSample {
                input: 1,
                output: 1,
                errors: 5,
                repeat_key: Some("e".to_string()),
            }),
            ..input("builder")
        };
        let first = breaker.tick(&config, &storm, 1);
        assert_eq!(first.state.level, BreakerLevel::Steering);
        assert_eq!(first.action, BreakerAction::Steer);
        let second = breaker.tick(&config, &storm, 2);
        assert_eq!(second.state.level, BreakerLevel::Constrained);
        assert_eq!(second.action, BreakerAction::Constrain);
        let third = breaker.tick(&config, &storm, 3);
        assert_eq!(third.state.level, BreakerLevel::Constrained);
        assert_eq!(third.action, BreakerAction::None);
    }

    #[test]
    fn recovery_from_constrained_steps_down_through_steering() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig::default();
        let storm = BreakerInput {
            sample: Some(BreakerSample {
                input: 1,
                output: 1,
                errors: 5,
                repeat_key: Some("e".to_string()),
            }),
            ..input("builder")
        };
        breaker.tick(&config, &storm, 1);
        breaker.tick(&config, &storm, 2);
        assert_eq!(breaker.level_for("builder"), BreakerLevel::Constrained);
        let step = breaker.tick(&config, &input("builder"), 3);
        assert_eq!(step.state.level, BreakerLevel::Steering);
        assert_eq!(step.action, BreakerAction::None);
        let back = breaker.tick(&config, &input("builder"), 4);
        assert_eq!(back.state.level, BreakerLevel::Healthy);
        assert!(back.state.reason.contains("recovering"));
    }

    #[test]
    fn hard_stop_raises_ceiling_to_stopped() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig {
            hard_stop: true,
            ..BreakerConfig::default()
        };
        let storm = BreakerInput {
            sample: Some(BreakerSample {
                input: 1,
                output: 1,
                errors: 9,
                repeat_key: Some("e".to_string()),
            }),
            ..input("builder")
        };
        let mut last = breaker.tick(&config, &storm, 1);
        let mut stop_edge = last.action == BreakerAction::Stop;
        for now in 2..=6 {
            last = breaker.tick(&config, &storm, now);
            stop_edge = stop_edge || last.action == BreakerAction::Stop;
        }
        assert_eq!(last.state.level, BreakerLevel::Stopped);
        assert!(stop_edge);
    }

    #[test]
    fn recovery_steps_down_and_reports_cleared_signals() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig::default();
        for now in 1..=8 {
            breaker.tick(&config, &sample("builder", "k"), now);
        }
        assert_eq!(breaker.level_for("builder"), BreakerLevel::Steering);
        let step = breaker.tick(&config, &input("builder"), 9);
        assert_eq!(step.state.level, BreakerLevel::Healthy);
        assert_eq!(step.action, BreakerAction::None);
        assert!(step.state.reason.contains("recovering"));
    }

    #[test]
    fn forget_resets_agent_track() {
        let mut breaker = CircuitBreaker::default();
        let config = BreakerConfig::default();
        for now in 1..=8 {
            breaker.tick(&config, &sample("builder", "k"), now);
        }
        breaker.forget("builder");
        assert_eq!(breaker.level_for("builder"), BreakerLevel::Healthy);
    }
}
