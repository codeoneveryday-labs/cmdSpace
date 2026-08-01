use super::remote_auth::{RemoteAuth, RemoteAuthError, MIN_PASSWORD_LENGTH};

#[test]
fn bootstrap_sets_password_once_and_password_login_issues_tokens() {
    let mut auth = RemoteAuth::from_material("bootstrap", [7_u8; 32], 2_000, 3_600);

    auth.setup_password("bootstrap", "correct horse", 1_000)
        .unwrap();

    assert!(auth.password_configured());
    let token = auth
        .authenticate_password("correct horse", "phone", 1_001)
        .unwrap();
    assert_eq!(
        auth.verify_session_token(&token, 1_002).unwrap().device,
        "phone"
    );
    assert_eq!(
        auth.authenticate_password("wrong horse", "phone", 1_003),
        Err(RemoteAuthError::InvalidPassword)
    );
    assert_eq!(
        auth.setup_password("bootstrap", "another password", 1_004),
        Err(RemoteAuthError::PasswordAlreadyConfigured)
    );
}

#[test]
fn password_setup_requires_valid_bootstrap_and_minimum_length() {
    let mut auth = RemoteAuth::from_material("bootstrap", [8_u8; 32], 2_000, 3_600);

    assert_eq!(
        auth.setup_password("wrong", "correct horse", 1_000),
        Err(RemoteAuthError::BootstrapInvalid)
    );
    assert_eq!(
        auth.setup_password("bootstrap", &"x".repeat(MIN_PASSWORD_LENGTH - 1), 1_001),
        Err(RemoteAuthError::PasswordTooShort)
    );
    assert!(!auth.password_configured());
}

#[test]
fn password_verifier_can_be_restored_after_restart() {
    let mut first = RemoteAuth::from_material("bootstrap", [11_u8; 32], 2_000, 3_600);
    first
        .setup_password("bootstrap", "persistent password", 1_000)
        .unwrap();
    let verifier = first.password_verifier().unwrap().to_string();

    let mut restored = RemoteAuth::from_material("new-bootstrap", [12_u8; 32], 2_000, 3_600);
    restored.restore_password_verifier(verifier).unwrap();

    assert!(restored
        .authenticate_password("persistent password", "desktop", 1_001)
        .is_ok());
}

#[test]
fn resetting_password_revokes_sessions_and_creates_a_fresh_setup_secret() {
    let mut auth = RemoteAuth::from_material("bootstrap", [13_u8; 32], 2_000, 3_600);
    auth.setup_password("bootstrap", "forgotten password", 1_000)
        .unwrap();
    let old_token = auth
        .authenticate_password("forgotten password", "phone", 1_001)
        .unwrap();
    let old_generation = auth.session_generation();

    let new_bootstrap = auth.reset_password(1_002).unwrap();

    assert!(!auth.password_configured());
    assert_ne!(auth.session_generation(), old_generation);
    assert_eq!(
        auth.verify_session_token(&old_token, 1_003),
        Err(RemoteAuthError::InvalidToken)
    );
    assert_eq!(
        auth.authenticate_password("forgotten password", "phone", 1_003),
        Err(RemoteAuthError::InvalidPassword)
    );
    auth.setup_password(&new_bootstrap, "replacement password", 1_004)
        .unwrap();
    assert!(auth
        .authenticate_password("replacement password", "phone", 1_005)
        .is_ok());
}
