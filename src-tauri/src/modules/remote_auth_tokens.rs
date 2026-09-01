use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use super::{RemoteAuthError, RemoteSessionClaims};

const TOKEN_ISSUER: &str = "cmdspace-remote";
type HmacSha256 = Hmac<Sha256>;

pub(super) fn issue_session_token(
    signing_key: &[u8; 32],
    session_ttl_seconds: u64,
    device: &str,
    now: u64,
) -> Result<String, RemoteAuthError> {
    let device = device.trim();
    if device.is_empty() || device.len() > 80 {
        return Err(RemoteAuthError::BootstrapInvalid);
    }
    let mut session_id = [0_u8; 16];
    getrandom::fill(&mut session_id).map_err(|error| RemoteAuthError::System(error.to_string()))?;
    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let claims = RemoteSessionClaims {
        iss: TOKEN_ISSUER.to_string(),
        exp: now.saturating_add(session_ttl_seconds),
        sid: URL_SAFE_NO_PAD.encode(session_id),
        device: device.to_string(),
    };
    let payload =
        serde_json::to_vec(&claims).map_err(|error| RemoteAuthError::System(error.to_string()))?;
    let payload = URL_SAFE_NO_PAD.encode(payload);
    let signed = format!("{header}.{payload}");
    let mut mac = HmacSha256::new_from_slice(signing_key)
        .map_err(|error| RemoteAuthError::System(error.to_string()))?;
    mac.update(signed.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(format!("{signed}.{signature}"))
}

pub(super) fn verify_session_token(
    signing_key: &[u8; 32],
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
    let mut mac =
        HmacSha256::new_from_slice(signing_key).map_err(|_| RemoteAuthError::InvalidToken)?;
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

#[cfg(test)]
mod tests {
    use super::{issue_session_token, verify_session_token};
    use crate::modules::remote_auth::RemoteAuthError;

    #[test]
    fn rejects_tampered_and_expired_session_tokens() {
        let key = [7_u8; 32];
        let token = issue_session_token(&key, 60, "phone", 100).unwrap();

        let mut tampered = token.clone();
        tampered.push('x');
        assert_eq!(
            verify_session_token(&key, &tampered, 101),
            Err(RemoteAuthError::InvalidToken)
        );
        assert_eq!(
            verify_session_token(&key, &token, 160),
            Err(RemoteAuthError::TokenExpired)
        );
    }
}
