use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use scrypt::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Params as ScryptParams, Scrypt,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::IpAddr,
    time::{SystemTime, UNIX_EPOCH},
};
use subtle::ConstantTimeEq;

const BOOTSTRAP_TTL_SECONDS: u64 = 5 * 60;
const SESSION_TTL_SECONDS: u64 = 24 * 60 * 60;
const AUTH_WINDOW_SECONDS: u64 = 60;
const AUTH_MAX_FAILURES: usize = 5;
const TOKEN_ISSUER: &str = "cmdspace-remote";
pub const MIN_PASSWORD_LENGTH: usize = 8;
const SCRYPT_LOG_N: u8 = 14;

type HmacSha256 = Hmac<Sha256>;

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

struct AuthFailures {
    attempts: Vec<u64>,
}

pub struct RemoteAuth {
    bootstrap_hash: [u8; 32],
    bootstrap_expires_at: u64,
    bootstrap_used: bool,
    password_verifier: Option<String>,
    signing_key: [u8; 32],
    session_generation: u64,
    session_ttl_seconds: u64,
    failures: HashMap<IpAddr, AuthFailures>,
}

impl RemoteAuth {
    pub fn new() -> Result<(Self, String), RemoteAuthError> {
        let mut signing_key = [0_u8; 32];
        getrandom::fill(&mut signing_key)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let bootstrap_secret = generate_bootstrap_secret()?;
        let auth = Self::from_material(
            &bootstrap_secret,
            signing_key,
            now_unix_seconds().saturating_add(BOOTSTRAP_TTL_SECONDS),
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
        let digest = Sha256::digest(bootstrap_secret.as_bytes());
        let mut bootstrap_hash = [0_u8; 32];
        bootstrap_hash.copy_from_slice(&digest);
        Self {
            bootstrap_hash,
            bootstrap_expires_at,
            bootstrap_used: false,
            password_verifier: None,
            signing_key,
            session_generation: 0,
            session_ttl_seconds,
            failures: HashMap::new(),
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
        let bootstrap_secret = generate_bootstrap_secret()?;
        let digest = Sha256::digest(bootstrap_secret.as_bytes());

        self.bootstrap_hash.copy_from_slice(&digest);
        self.bootstrap_expires_at = now.saturating_add(BOOTSTRAP_TTL_SECONDS);
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
        PasswordHash::new(&password_verifier)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
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
        let mut salt_bytes = [0_u8; 16];
        getrandom::fill(&mut salt_bytes)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let salt = SaltString::encode_b64(&salt_bytes)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let params = ScryptParams::new(SCRYPT_LOG_N, 8, 1, 32)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let verifier = Scrypt
            .hash_password_customized(password.as_bytes(), None, None, params, &salt)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?
            .to_string();
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
        let parsed = PasswordHash::new(verifier).map_err(|_| RemoteAuthError::InvalidPassword)?;
        Scrypt
            .verify_password(password.as_bytes(), &parsed)
            .map_err(|_| RemoteAuthError::InvalidPassword)?;
        self.issue_session_token(device, now)
    }

    fn verify_bootstrap(&self, bootstrap_secret: &str, now: u64) -> Result<(), RemoteAuthError> {
        if self.bootstrap_used {
            return Err(RemoteAuthError::BootstrapUsed);
        }
        if now >= self.bootstrap_expires_at {
            return Err(RemoteAuthError::BootstrapExpired);
        }
        let candidate = Sha256::digest(bootstrap_secret.as_bytes());
        if bool::from(candidate.as_slice().ct_eq(&self.bootstrap_hash)) {
            Ok(())
        } else {
            Err(RemoteAuthError::BootstrapInvalid)
        }
    }

    pub fn verify_session_token(
        &self,
        token: &str,
        now: u64,
    ) -> Result<RemoteSessionClaims, RemoteAuthError> {
        let mut sections = token.split('.');
        let (Some(header), Some(payload), Some(signature), None) = (
            sections.next(),
            sections.next(),
            sections.next(),
            sections.next(),
        ) else {
            return Err(RemoteAuthError::InvalidToken);
        };
        let signed = format!("{header}.{payload}");
        let signature = URL_SAFE_NO_PAD
            .decode(signature)
            .map_err(|_| RemoteAuthError::InvalidToken)?;
        let mut mac = HmacSha256::new_from_slice(&self.signing_key)
            .map_err(|_| RemoteAuthError::InvalidToken)?;
        mac.update(signed.as_bytes());
        mac.verify_slice(&signature)
            .map_err(|_| RemoteAuthError::InvalidToken)?;
        let payload = URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| RemoteAuthError::InvalidToken)?;
        let claims: RemoteSessionClaims =
            serde_json::from_slice(&payload).map_err(|_| RemoteAuthError::InvalidToken)?;
        if claims.iss != TOKEN_ISSUER || claims.sid.is_empty() || claims.device.is_empty() {
            return Err(RemoteAuthError::InvalidToken);
        }
        if now >= claims.exp {
            return Err(RemoteAuthError::TokenExpired);
        }
        Ok(claims)
    }

    pub fn allow_auth_attempt(&mut self, client_ip: IpAddr, now: u64) -> bool {
        let attempts = self.failures.entry(client_ip).or_insert(AuthFailures {
            attempts: Vec::new(),
        });
        attempts
            .attempts
            .retain(|attempt| now.saturating_sub(*attempt) < AUTH_WINDOW_SECONDS);
        attempts.attempts.len() < AUTH_MAX_FAILURES
    }

    pub fn record_failed_auth_attempt(&mut self, client_ip: IpAddr, now: u64) {
        self.failures
            .entry(client_ip)
            .or_insert(AuthFailures {
                attempts: Vec::new(),
            })
            .attempts
            .push(now);
    }

    fn issue_session_token(&self, device: &str, now: u64) -> Result<String, RemoteAuthError> {
        let device = device.trim();
        if device.is_empty() || device.len() > 80 {
            return Err(RemoteAuthError::BootstrapInvalid);
        }
        let mut session_id = [0_u8; 16];
        getrandom::fill(&mut session_id)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
        let claims = RemoteSessionClaims {
            iss: TOKEN_ISSUER.to_string(),
            exp: now.saturating_add(self.session_ttl_seconds),
            sid: URL_SAFE_NO_PAD.encode(session_id),
            device: device.to_string(),
        };
        let payload = serde_json::to_vec(&claims)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        let payload = URL_SAFE_NO_PAD.encode(payload);
        let signed = format!("{header}.{payload}");
        let mut mac = HmacSha256::new_from_slice(&self.signing_key)
            .map_err(|error| RemoteAuthError::System(error.to_string()))?;
        mac.update(signed.as_bytes());
        let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
        Ok(format!("{signed}.{signature}"))
    }
}

fn generate_bootstrap_secret() -> Result<String, RemoteAuthError> {
    let mut bootstrap_bytes = [0_u8; 32];
    getrandom::fill(&mut bootstrap_bytes)
        .map_err(|error| RemoteAuthError::System(error.to_string()))?;
    Ok(URL_SAFE_NO_PAD.encode(bootstrap_bytes))
}

pub fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
