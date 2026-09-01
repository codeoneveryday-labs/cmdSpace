use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use super::RemoteAuthError;

pub(super) const TTL_SECONDS: u64 = 5 * 60;

pub(super) fn generate_secret() -> Result<String, RemoteAuthError> {
    let mut bootstrap_bytes = [0_u8; 32];
    getrandom::fill(&mut bootstrap_bytes)
        .map_err(|error| RemoteAuthError::System(error.to_string()))?;
    Ok(URL_SAFE_NO_PAD.encode(bootstrap_bytes))
}

pub(super) fn hash_secret(secret: &str) -> [u8; 32] {
    let digest = Sha256::digest(secret.as_bytes());
    let mut hash = [0_u8; 32];
    hash.copy_from_slice(&digest);
    hash
}

pub(super) fn verify_secret(
    hash: &[u8; 32],
    used: bool,
    expires_at: u64,
    secret: &str,
    now: u64,
) -> Result<(), RemoteAuthError> {
    if used {
        return Err(RemoteAuthError::BootstrapUsed);
    }
    if now >= expires_at {
        return Err(RemoteAuthError::BootstrapExpired);
    }
    let candidate = Sha256::digest(secret.as_bytes());
    if bool::from(candidate.as_slice().ct_eq(hash)) {
        Ok(())
    } else {
        Err(RemoteAuthError::BootstrapInvalid)
    }
}

#[cfg(test)]
mod tests {
    use super::{hash_secret, verify_secret};
    use crate::modules::remote_auth::RemoteAuthError;

    #[test]
    fn preserves_bootstrap_used_expired_and_secret_validation_order() {
        let hash = hash_secret("bootstrap");

        assert!(verify_secret(&hash, false, 200, "bootstrap", 100).is_ok());
        assert_eq!(
            verify_secret(&hash, false, 200, "wrong", 100),
            Err(RemoteAuthError::BootstrapInvalid)
        );
        assert_eq!(
            verify_secret(&hash, false, 100, "bootstrap", 100),
            Err(RemoteAuthError::BootstrapExpired)
        );
        assert_eq!(
            verify_secret(&hash, true, 100, "bootstrap", 100),
            Err(RemoteAuthError::BootstrapUsed)
        );
    }
}
