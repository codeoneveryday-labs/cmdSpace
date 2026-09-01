use std::collections::HashMap;
use std::net::IpAddr;

const AUTH_WINDOW_SECONDS: u64 = 60;
const AUTH_MAX_FAILURES: usize = 5;

struct AuthFailures {
    attempts: Vec<u64>,
}

#[derive(Default)]
pub(super) struct AuthRateLimiter {
    failures: HashMap<IpAddr, AuthFailures>,
}

impl AuthRateLimiter {
    pub(super) fn clear(&mut self) {
        self.failures.clear();
    }

    pub(super) fn allow(&mut self, client_ip: IpAddr, now: u64) -> bool {
        let attempts = self.failures.entry(client_ip).or_insert(AuthFailures {
            attempts: Vec::new(),
        });
        attempts
            .attempts
            .retain(|attempt| now.saturating_sub(*attempt) < AUTH_WINDOW_SECONDS);
        attempts.attempts.len() < AUTH_MAX_FAILURES
    }

    pub(super) fn record(&mut self, client_ip: IpAddr, now: u64) {
        self.failures
            .entry(client_ip)
            .or_insert(AuthFailures {
                attempts: Vec::new(),
            })
            .attempts
            .push(now);
    }
}

#[cfg(test)]
mod tests {
    use super::AuthRateLimiter;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn limits_failed_attempts_per_client_within_the_window() {
        let mut limiter = AuthRateLimiter::default();
        let client = IpAddr::V4(Ipv4Addr::LOCALHOST);

        for now in 0..5 {
            assert!(limiter.allow(client, now));
            limiter.record(client, now);
        }
        assert!(!limiter.allow(client, 5));
        assert!(limiter.allow(client, 64));
    }
}
