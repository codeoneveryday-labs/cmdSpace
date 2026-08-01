use super::remote_tunnel::{
    cloudflared_quick_tunnel_args, extract_public_https_url, localhost_run_ssh_args, TunnelState,
};

#[cfg(unix)]
use super::remote_tunnel::LocalhostRunTunnel;
#[cfg(unix)]
use std::time::{Duration, Instant};

#[test]
fn extracts_trusted_localhost_run_urls_from_provider_output() {
    assert_eq!(
        extract_public_https_url(
            "your tunnel is ready: https://quiet-river-42.lhr.life, share it safely"
        ),
        Some("https://quiet-river-42.lhr.life".to_string())
    );
    assert_eq!(
        extract_public_https_url("Connect at \"https://demo.localhost.run/path\"."),
        Some("https://demo.localhost.run/path".to_string())
    );
    assert_eq!(
        extract_public_https_url("\u{1b}[32mhttps://colored.lhr.life\u{1b}[0m"),
        Some("https://colored.lhr.life".to_string())
    );
    assert_eq!(
        extract_public_https_url("Visit https://quick-tunnel.trycloudflare.com now"),
        Some("https://quick-tunnel.trycloudflare.com".to_string())
    );
}

#[test]
fn rejects_untrusted_or_insecure_provider_urls() {
    assert_eq!(
        extract_public_https_url("Manage your tunnel at https://admin.localhost.run/"),
        None
    );
    assert_eq!(
        extract_public_https_url("Learn more at https://localhost.run/docs/forever-free/"),
        None
    );
    assert_eq!(extract_public_https_url("https://lhr.life/help"), None);
    assert_eq!(extract_public_https_url("https://lhr.rocks/help"), None);
    assert_eq!(
        extract_public_https_url("https://attacker.example/localhost.run"),
        None
    );
    assert_eq!(extract_public_https_url("http://demo.localhost.run"), None);
    assert_eq!(
        extract_public_https_url("https://localhost.run.attacker.example"),
        None
    );
}

#[test]
fn tunnel_states_serialize_for_the_frontend_contract() {
    assert_eq!(
        serde_json::to_string(&TunnelState::Starting).unwrap(),
        "\"starting\""
    );
    assert_eq!(
        serde_json::to_string(&TunnelState::Ready).unwrap(),
        "\"ready\""
    );
    assert_eq!(
        serde_json::to_string(&TunnelState::Degraded).unwrap(),
        "\"degraded\""
    );
    assert_eq!(
        serde_json::to_string(&TunnelState::Error).unwrap(),
        "\"error\""
    );
    assert_eq!(
        serde_json::to_string(&TunnelState::Stopped).unwrap(),
        "\"stopped\""
    );
}

#[test]
fn builds_a_non_interactive_localhost_run_reverse_tunnel() {
    assert_eq!(
        localhost_run_ssh_args(53_631),
        vec![
            "-T",
            "-o",
            "BatchMode=yes",
            "-o",
            "ExitOnForwardFailure=yes",
            "-o",
            "ServerAliveInterval=60",
            "-o",
            "ServerAliveCountMax=3",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-R",
            "80:127.0.0.1:53631",
            "nokey@localhost.run",
        ]
    );
}

#[test]
fn builds_a_cloudflare_quick_tunnel_for_the_local_remote_server() {
    assert_eq!(
        cloudflared_quick_tunnel_args(53_631),
        vec![
            "tunnel",
            "--url",
            "http://127.0.0.1:53631",
            "--no-autoupdate",
        ]
    );
}

#[cfg(unix)]
#[test]
fn supervisor_captures_the_public_url_and_stops_cleanly() {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    let temp = tempfile::tempdir().unwrap();
    let script = temp.path().join("fake-tunnel.sh");
    fs::write(
        &script,
        "#!/bin/sh\necho 'ready https://test-tunnel.lhr.life'\nwhile true; do sleep 1; done\n",
    )
    .unwrap();
    let mut permissions = fs::metadata(&script).unwrap().permissions();
    permissions.set_mode(0o700);
    fs::set_permissions(&script, permissions).unwrap();

    let mut tunnel = LocalhostRunTunnel::start_command_for_test(&script, Vec::new()).unwrap();
    let deadline = Instant::now() + Duration::from_secs(2);
    while tunnel.snapshot().state != TunnelState::Ready && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(20));
    }

    let ready = tunnel.snapshot();
    assert_eq!(ready.state, TunnelState::Ready);
    assert_eq!(
        ready.public_url.as_deref(),
        Some("https://test-tunnel.lhr.life")
    );

    tunnel.stop();
    assert_eq!(tunnel.snapshot().state, TunnelState::Stopped);
}
