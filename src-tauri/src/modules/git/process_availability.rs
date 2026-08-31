use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::runner::run_git_uncached;
use crate::modules::git::types::MIN_GIT_VERSION;
use crate::modules::workspace::WorkspaceEnv;

#[derive(Clone)]
enum Availability {
    Ok,
    NotInstalled,
    TooOld(String),
}

const AVAILABILITY_TTL: Duration = Duration::from_secs(60);

struct AvailabilityCache {
    value: Availability,
    checked_at: Instant,
}

static GIT_AVAILABILITY: OnceLock<Mutex<HashMap<String, AvailabilityCache>>> = OnceLock::new();

fn availability_cell() -> &'static Mutex<HashMap<String, AvailabilityCache>> {
    GIT_AVAILABILITY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn prune_expired_availability_entries(cache: &mut HashMap<String, AvailabilityCache>) {
    cache.retain(|_, entry| entry.checked_at.elapsed() < AVAILABILITY_TTL);
}

fn workspace_cache_key(workspace: &WorkspaceEnv) -> String {
    match workspace {
        WorkspaceEnv::Local => "local".into(),
        WorkspaceEnv::Wsl { distro } => format!("wsl:{distro}"),
    }
}

pub fn ensure_git_available(workspace: &WorkspaceEnv) -> Result<()> {
    let cache_key = workspace_cache_key(workspace);
    let cached = {
        let mut guard = availability_cell()
            .lock()
            .expect("git availability poisoned");
        prune_expired_availability_entries(&mut guard);
        guard
            .get(&cache_key)
            .filter(|entry| entry.checked_at.elapsed() < AVAILABILITY_TTL)
            .map(|entry| entry.value.clone())
    };
    let value = match cached {
        Some(v) => v,
        None => {
            let fresh = check_git_availability(workspace);
            let mut guard = availability_cell()
                .lock()
                .expect("git availability poisoned");
            prune_expired_availability_entries(&mut guard);
            guard.insert(
                cache_key,
                AvailabilityCache {
                    value: fresh.clone(),
                    checked_at: Instant::now(),
                },
            );
            fresh
        }
    };
    match value {
        Availability::Ok => Ok(()),
        Availability::NotInstalled => Err(GitError::NotInstalled),
        Availability::TooOld(v) => Err(GitError::TooOld {
            found: v,
            required: MIN_GIT_VERSION,
        }),
    }
}

fn check_git_availability(workspace: &WorkspaceEnv) -> Availability {
    let output = match run_git_uncached(workspace, None, ["--version"], 10) {
        Ok(o) => o,
        Err(_) => return Availability::NotInstalled,
    };
    if output.timed_out || output.exit_code != Some(0) {
        return Availability::NotInstalled;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let version = parse_git_version(stdout.trim()).unwrap_or_else(|| "unknown".into());
    if !version_meets_minimum(&version, MIN_GIT_VERSION) {
        return Availability::TooOld(version);
    }
    Availability::Ok
}

fn parse_git_version(line: &str) -> Option<String> {
    line.split_whitespace()
        .find(|tok| tok.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .map(|s| s.split('.').take(3).collect::<Vec<_>>().join("."))
}

fn version_meets_minimum(found: &str, required: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect()
    };
    let f = parse(found);
    let r = parse(required);
    for (i, &b) in r.iter().enumerate() {
        let a = f.get(i).copied().unwrap_or(0);
        if a > b {
            return true;
        }
        if a < b {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::{parse_git_version, prune_expired_availability_entries, version_meets_minimum};
    use super::{Availability, AvailabilityCache, AVAILABILITY_TTL};
    use std::collections::HashMap;
    use std::time::{Duration, Instant};

    #[test]
    fn extracts_simple_version() {
        assert_eq!(
            parse_git_version("git version 2.42.0"),
            Some("2.42.0".into())
        );
    }

    #[test]
    fn extracts_apple_version() {
        assert_eq!(
            parse_git_version("git version 2.39.3 (Apple Git-145)"),
            Some("2.39.3".into())
        );
    }

    #[test]
    fn version_compare() {
        assert!(version_meets_minimum("2.23.0", "2.23"));
        assert!(version_meets_minimum("2.40.1", "2.23"));
        assert!(version_meets_minimum("3.0.0", "2.23"));
        assert!(!version_meets_minimum("2.22.0", "2.23"));
        assert!(!version_meets_minimum("1.9.5", "2.23"));
        assert!(version_meets_minimum("2.23.5", "2.23.4"));
        assert!(!version_meets_minimum("2.23.3", "2.23.4"));
    }

    #[test]
    fn prunes_expired_workspace_availability_entries() {
        let mut cache = HashMap::from([
            (
                "local".to_string(),
                AvailabilityCache {
                    value: Availability::Ok,
                    checked_at: Instant::now(),
                },
            ),
            (
                "wsl:Ubuntu".to_string(),
                AvailabilityCache {
                    value: Availability::NotInstalled,
                    checked_at: Instant::now() - AVAILABILITY_TTL - Duration::from_secs(1),
                },
            ),
        ]);

        prune_expired_availability_entries(&mut cache);

        assert!(cache.contains_key("local"));
        assert!(!cache.contains_key("wsl:Ubuntu"));
    }
}
