use scrypt::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Params as ScryptParams, Scrypt,
};

use super::RemoteAuthError;

const SCRYPT_LOG_N: u8 = 14;

pub(super) fn validate_verifier(verifier: &str) -> Result<(), RemoteAuthError> {
    PasswordHash::new(verifier)
        .map(|_| ())
        .map_err(|error| RemoteAuthError::System(error.to_string()))
}

pub(super) fn hash_password(password: &str) -> Result<String, RemoteAuthError> {
    let mut salt_bytes = [0_u8; 16];
    getrandom::fill(&mut salt_bytes).map_err(|error| RemoteAuthError::System(error.to_string()))?;
    let salt = SaltString::encode_b64(&salt_bytes)
        .map_err(|error| RemoteAuthError::System(error.to_string()))?;
    let params = ScryptParams::new(SCRYPT_LOG_N, 8, 1, 32)
        .map_err(|error| RemoteAuthError::System(error.to_string()))?;
    Scrypt
        .hash_password_customized(password.as_bytes(), None, None, params, &salt)
        .map(|password_hash| password_hash.to_string())
        .map_err(|error| RemoteAuthError::System(error.to_string()))
}

pub(super) fn verify_password(password: &str, verifier: &str) -> Result<(), RemoteAuthError> {
    let parsed = PasswordHash::new(verifier).map_err(|_| RemoteAuthError::InvalidPassword)?;
    Scrypt
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| RemoteAuthError::InvalidPassword)
}

#[cfg(test)]
mod tests {
    use super::{hash_password, validate_verifier, verify_password};
    use crate::modules::remote_auth::RemoteAuthError;

    #[test]
    fn hashes_and_verifies_passwords_without_exposing_plaintext() {
        let verifier = hash_password("correct horse").unwrap();

        assert_ne!(verifier, "correct horse");
        assert!(validate_verifier(&verifier).is_ok());
        assert!(verify_password("correct horse", &verifier).is_ok());
        assert_eq!(
            verify_password("wrong horse", &verifier),
            Err(RemoteAuthError::InvalidPassword)
        );
    }
}
