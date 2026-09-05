use ed25519_dalek::{Signer, SigningKey};
use tempfile::tempdir;

use super::remote_devices::{DeviceCapability, DeviceRegistry, PairingGrantError};

#[test]
fn pairing_grant_is_consumed_once_for_the_expected_device_key() {
    let mut registry = DeviceRegistry::new_for_test([7_u8; 32]);
    let capability = DeviceCapability::workspace_terminal_controller("workspace-1", 42);
    let grant = registry.issue_grant("Boji iPhone", capability, 1_000, 60);
    let signing_key = SigningKey::from_bytes(&[9_u8; 32]);
    let signature = signing_key.sign(grant.secret.as_bytes());

    let created = registry
        .consume_grant_with_proof(
            &grant.secret,
            signing_key.verifying_key().to_bytes(),
            signature.to_bytes(),
            1_030,
        )
        .expect("first pairing should create a device");

    assert_eq!(created.display_name, "Boji iPhone");
    assert_eq!(created.public_key, signing_key.verifying_key().to_bytes());
    assert!(matches!(
        registry.consume_grant_with_proof(
            &grant.secret,
            signing_key.verifying_key().to_bytes(),
            signature.to_bytes(),
            1_031,
        ),
        Err(PairingGrantError::Consumed)
    ));
}

#[test]
fn expired_pairing_grant_does_not_create_a_device() {
    let mut registry = DeviceRegistry::new_for_test([3_u8; 32]);
    let grant = registry.issue_grant(
        "Test iPad",
        DeviceCapability::workspace_terminal_viewer("workspace-1"),
        1_000,
        60,
    );

    let signing_key = SigningKey::from_bytes(&[4_u8; 32]);
    let signature = signing_key.sign(grant.secret.as_bytes());
    assert!(matches!(
        registry.consume_grant_with_proof(
            &grant.secret,
            signing_key.verifying_key().to_bytes(),
            signature.to_bytes(),
            1_061,
        ),
        Err(PairingGrantError::Expired)
    ));
    assert!(registry.devices().is_empty());
}

#[test]
fn pairing_rejects_a_proof_not_signed_by_the_registered_device_key() {
    let mut registry = DeviceRegistry::new_for_test([6_u8; 32]);
    let grant = registry.issue_grant(
        "Test iPad",
        DeviceCapability::workspace_terminal_viewer("workspace-1"),
        1_000,
        60,
    );
    let claimed_key = SigningKey::from_bytes(&[8_u8; 32]);
    let attacker_key = SigningKey::from_bytes(&[5_u8; 32]);

    assert!(matches!(
        registry.consume_grant_with_proof(
            &grant.secret,
            claimed_key.verifying_key().to_bytes(),
            attacker_key.sign(grant.secret.as_bytes()).to_bytes(),
            1_030,
        ),
        Err(PairingGrantError::InvalidProof)
    ));
    assert!(registry.devices().is_empty());
}

#[test]
fn revoking_one_device_preserves_another_devices_authority() {
    let mut registry = DeviceRegistry::new_for_test([2_u8; 32]);
    let (grant_a, signature_a, key_a) =
        issue_signed_grant(&mut registry, "Boji iPhone", [1_u8; 32]);
    let (grant_b, signature_b, key_b) = issue_signed_grant(&mut registry, "Test iPad", [2_u8; 32]);
    let device_a = registry
        .consume_grant_with_proof(&grant_a, key_a, signature_a, 1_030)
        .unwrap();
    let device_b = registry
        .consume_grant_with_proof(&grant_b, key_b, signature_b, 1_030)
        .unwrap();

    registry.revoke(&device_a.id, 1_040).unwrap();

    assert!(registry.device(&device_a.id).is_none());
    assert!(registry.device(&device_b.id).unwrap().revoked_at.is_none());
}

#[test]
fn revoking_a_device_removes_it_from_the_persisted_registry() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("remote-devices.json");
    let mut registry = DeviceRegistry::load_or_create(&path, [3_u8; 32]).unwrap();
    let (grant, signature, key) = issue_signed_grant(&mut registry, "Boji iPhone", [1_u8; 32]);
    let device = registry
        .consume_grant_with_proof(&grant, key, signature, 1_030)
        .unwrap();
    registry.revoke(&device.id, 1_040).unwrap();
    registry.save().unwrap();

    let restored = DeviceRegistry::load_or_create(&path, [3_u8; 32]).unwrap();

    assert!(restored.device(&device.id).is_none());
}

#[test]
fn device_removal_survives_registry_reload() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("remote-devices.json");
    let mut registry = DeviceRegistry::load_or_create(&path, [3_u8; 32]).unwrap();
    let (grant, signature, key) = issue_signed_grant(&mut registry, "Boji iPhone", [1_u8; 32]);
    let device = registry
        .consume_grant_with_proof(&grant, key, signature, 1_030)
        .unwrap();
    registry.revoke(&device.id, 1_040).unwrap();
    registry.save().unwrap();

    let restored = DeviceRegistry::load_or_create(&path, [3_u8; 32]).unwrap();

    assert!(restored.device(&device.id).is_none());
}

#[test]
fn loading_a_legacy_registry_drops_revoked_devices() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("remote-devices.json");
    std::fs::write(
        &path,
        r#"{"devices":[{"id":"old-phone","display_name":"Old phone","public_key":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"capability":{"workspace_id":"remote-runtime","terminal_policy":"AnyOwnedSession","can_view":true,"can_input":true,"can_create_terminal":true,"can_close_terminal":true},"revoked_at":1040}]}"#,
    )
    .unwrap();

    let registry = DeviceRegistry::load_or_create(&path, [3_u8; 32]).unwrap();

    assert!(registry.devices().is_empty());
}

#[test]
fn capability_blocks_input_outside_the_granted_session() {
    let mut registry = DeviceRegistry::new_for_test([4_u8; 32]);
    let grant = registry.issue_grant(
        "Boji iPhone",
        DeviceCapability::workspace_terminal_controller("workspace-1", 42),
        1_000,
        60,
    );
    let key = SigningKey::from_bytes(&[1_u8; 32]);
    let device = registry
        .consume_grant_with_proof(
            &grant.secret,
            key.verifying_key().to_bytes(),
            key.sign(grant.secret.as_bytes()).to_bytes(),
            1_030,
        )
        .unwrap();

    assert!(registry.can_input(&device.id, "workspace-1", 42));
    assert!(!registry.can_input(&device.id, "workspace-1", 43));
    assert!(!registry.can_input(&device.id, "workspace-2", 42));
}

#[test]
fn removed_device_cannot_complete_a_signed_reconnect_challenge() {
    let mut registry = DeviceRegistry::new_for_test([5_u8; 32]);
    let (grant, signature, key) = issue_signed_grant(&mut registry, "Boji iPhone", [7_u8; 32]);
    let device = registry
        .consume_grant_with_proof(&grant, key, signature, 1_030)
        .unwrap();
    let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
    let challenge = b"fresh-host-challenge";

    assert!(registry.verify_device_proof(
        &device.id,
        challenge,
        signing_key.sign(challenge).to_bytes(),
    ));
    registry.revoke(&device.id, 1_040).unwrap();
    assert!(!registry.verify_device_proof(
        &device.id,
        challenge,
        signing_key.sign(challenge).to_bytes(),
    ));
}

#[test]
fn a_revoked_device_can_pair_again_with_a_new_grant() {
    let mut registry = DeviceRegistry::new_for_test([6_u8; 32]);
    let (first_grant, first_proof, public_key) =
        issue_signed_grant(&mut registry, "Boji iPhone", [8_u8; 32]);
    let device = registry
        .consume_grant_with_proof(&first_grant, public_key, first_proof, 1_030)
        .unwrap();
    registry.revoke(&device.id, 1_040).unwrap();

    let (second_grant, second_proof, _) =
        issue_signed_grant(&mut registry, "Boji iPhone", [8_u8; 32]);
    let re_paired = registry
        .consume_grant_with_proof(&second_grant, public_key, second_proof, 1_050)
        .unwrap();
    let signing_key = SigningKey::from_bytes(&[8_u8; 32]);

    assert_eq!(registry.devices().len(), 1);
    assert!(re_paired.revoked_at.is_none());
    assert!(registry.verify_device_proof(
        &re_paired.id,
        b"fresh-host-challenge",
        signing_key.sign(b"fresh-host-challenge").to_bytes(),
    ));
}

fn issue_signed_grant(
    registry: &mut DeviceRegistry,
    name: &str,
    seed: [u8; 32],
) -> (String, [u8; 64], [u8; 32]) {
    let grant = registry.issue_grant(
        name,
        DeviceCapability::workspace_terminal_viewer("workspace-1"),
        1_000,
        60,
    );
    let key = SigningKey::from_bytes(&seed);
    (
        grant.secret.clone(),
        key.sign(grant.secret.as_bytes()).to_bytes(),
        key.verifying_key().to_bytes(),
    )
}
