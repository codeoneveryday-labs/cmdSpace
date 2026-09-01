use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::time::{SystemTime, UNIX_EPOCH};

#[path = "remote_auth_bootstrap.rs"]
mod bootstrap;
#[path = "remote_auth_password.rs"]
mod password;
#[path = "remote_auth_rate_limit.rs"]
mod rate_limit;
#[path = "remote_auth_tokens.rs"]
mod tokens;

const SESSION_TTL_SECONDS: u64 = 24 * 60 * 60;
pub const MIN_PASSWORD_LENGTH: usize = 8;

#[derive(Debug, PartialEq, Eq)]
pub enum RemoteAuthError {
    BootstrapExpired,
    BootstrapInvalid,
    BootstrapUsed,
    InvalidPassword,
    PasswordAlreadyConfigured,
    PasswordTooShort,
    InvalidToken,
    TokenExpired,
    RateLimited,
    System(String),
}

impl std::fmt::Display for RemoteAuthError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::BootstrapExpired => "setup link has expired",
            Self::BootstrapInvalid => "setup link is invalid",
            Self::BootstrapUsed => "setup link has already been used",
            Self::InvalidPassword => "password is invalid",
            Self::PasswordAlreadyConfigured => "password is already configured",
            Self::PasswordTooShort => "password must contain at least 8 characters",
            Self::InvalidToken => "session token is invalid",
            Self::TokenExpired => "session token has expired",
            Self::RateLimited => "too many failed authentication attempts",
            Self::System(error) => error,
        };
        formatter.write_str(message)
    }
}

impl std::error::Error for RemoteAuthError {}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct RemoteSessionClaims {
    pub iss: String,
    pub exp: u64,
    pub sid: String,
    pub device: String,
}

pub struct RemoteAuth {
    bootstrap_hash: [u8; 32],
    bootstrap_expires_at: u64,
    bootstrap_used: bool,
    password_verifier: Option<String>,
    signing_key: [u8; 32],
    session_generation: u64,
    session_ttl_seconds: u64,
    failures: rate_limit::AuthRateLimiter,
}

impl RemoteAuth {
    pub fn new() -> Result<(Self, String), RemoteAuthError> {
        let mut signing_key = [0_u8; 32];
        getrandom::fill(&mut signing_key)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let bootstrap_secret = bootstrap::generate_secret()?;
        let auth = Self::from_material(
            &bootstrap_secret,
            signing_key,
            now_unix_seconds().saturating_add(bootstrap::TTL_SECONDS),
            SESSION_TTL_SECONDS,
        );
        Ok((auth, bootstrap_secret))
    }

    pub fn bootstrap_available(&self, now: u64) -> bool {
        !self.bootstrap_used && now < self.bootstrap_expires_at
    }

    pub(crate) fn from_material(
        bootstrap_secret: &str,
        signing_key: [u8; 32],
        bootstrap_expires_at: u64,
        session_ttl_seconds: u64,
    ) -> Self {
        let bootstrap_hash = bootstrap::hash_secret(bootstrap_secret);
        Self {
            bootstrap_hash,
            bootstrap_expires_at,
            bootstrap_used: false,
            password_verifier: None,
            signing_key,
            session_generation: 0,
            session_ttl_seconds,
            failures: rate_limit::AuthRateLimiter::default(),
        }
    }

    pub fn password_configured(&self) -> bool {
        self.password_verifier.is_some()
    }

    pub fn password_verifier(&self) -> Option<&str> {
        self.password_verifier.as_deref()
    }

    pub fn session_generation(&self) -> u64 {
        self.session_generation
    }

    pub fn reset_password(&mut self, now: u64) -> Result<String, RemoteAuthError> {
        let mut signing_key = [0_u8; 32];
        getrandom::fill(&mut signing_key)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let bootstrap_secret = bootstrap::generate_secret()?;

        self.bootstrap_hash = bootstrap::hash_secret(&bootstrap_secret);
        self.bootstrap_expires_at = now.saturating_add(bootstrap::TTL_SECONDS);
        self.bootstrap_used = false;
        self.password_verifier = None;
        self.signing_key = signing_key;
        self.session_generation = self.session_generation.wrapping_add(1);
        self.failures.clear();

        Ok(bootstrap_secret)
    }

    pub fn restore_password_verifier(
        &mut self,
        password_verifier: String,
    ) -> Result<(), RemoteAuthError> {
        password::validate_verifier(&password_verifier)?;
        self.password_verifier = Some(password_verifier);
        self.bootstrap_used = true;
        Ok(())
    }

    pub fn setup_password(
        &mut self,
        bootstrap_secret: &str,
        password: &str,
        now: u64,
    ) -> Result<(), RemoteAuthError> {
        if self.password_configured() {
            return Err(RemoteAuthError::PasswordAlreadyConfigured);
        }
        if password.chars().count() < MIN_PASSWORD_LENGTH {
            return Err(RemoteAuthError::PasswordTooShort);
        }
        self.verify_bootstrap(bootstrap_secret, now)?;
        let verifier = password::hash_password(password)?;
        self.password_verifier = Some(verifier);
        self.bootstrap_used = true;
        Ok(())
    }

    pub fn authenticate_password(
        &self,
        password: &str,
        device: &str,
        now: u64,
    ) -> Result<String, RemoteAuthError> {
        let verifier = self
            .password_verifier
            .as_deref()
            .ok_or(RemoteAuthError::InvalidPassword)?;
        password::verify_password(password, verifier)?;
        tokens::issue_session_token(&self.signing_key, self.session_ttl_seconds, device, now)
    }

    fn verify_bootstrap(&self, bootstrap_secret: &str, now: u64) -> Result<(), RemoteAuthError> {
        bootstrap::verify_secret(
            &self.bootstrap_hash,
            self.bootstrap_used,
            self.bootstrap_expires_at,
            bootstrap_secret,
            now,
        )
    }

    pub fn verify_session_token(
        &self,
        token: &str,
        now: u64,
    ) -> Result<RemoteSessionClaims, RemoteAuthError> {
        tokens::verify_session_token(&self.signing_key, token, now)
    }

    pub fn allow_auth_attempt(&mut self, client_ip: IpAddr, now: u64) -> bool {
        self.failures.allow(client_ip, now)
    }

    pub fn record_failed_auth_attempt(&mut self, client_ip: IpAddr, now: u64) {
        self.failures.record(client_ip, now);
    }
}

pub fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
