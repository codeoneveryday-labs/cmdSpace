use std::{
    ffi::OsString,
    net::ToSocketAddrs,
    process::{Command, Stdio},
};

use super::TunnelCommand;

pub fn public_tunnel_command(local_port: u16) -> TunnelCommand {
    // Quick tunnels can keep their process alive after their public hostname has
    // expired. Prefer the SSH relay when it is available so a paired phone keeps
    // receiving a routable endpoint.
    if command_is_available("ssh") {
        return TunnelCommand {
            program: OsString::from("ssh"),
            args: localhost_run_ssh_args(local_port)
                .into_iter()
                .map(OsString::from)
                .collect(),
            requires_origin_registration: false,
        };
    }

    if let Some(cloudflared) = find_cloudflared() {
        return TunnelCommand {
            program: cloudflared,
            args: cloudflared_quick_tunnel_args(local_port)
                .into_iter()
                .map(OsString::from)
                .collect(),
            requires_origin_registration: true,
        };
    }

    TunnelCommand {
        program: OsString::from("ssh"),
        args: localhost_run_ssh_args(local_port)
            .into_iter()
            .map(OsString::from)
            .collect(),
        requires_origin_registration: false,
    }
}

fn command_is_available(program: &str) -> bool {
    Command::new(program)
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn find_cloudflared() -> Option<OsString> {
    [
        "cloudflared",
        "/opt/homebrew/bin/cloudflared",
        "/usr/local/bin/cloudflared",
    ]
    .into_iter()
    .find_map(|candidate| command_is_available(candidate).then(|| OsString::from(candidate)))
}

pub(crate) fn cloudflared_quick_tunnel_args(local_port: u16) -> Vec<String> {
    [
        "tunnel".to_string(),
        "--url".to_string(),
        format!("http://127.0.0.1:{local_port}"),
        "--no-autoupdate".to_string(),
    ]
    .into_iter()
    .collect()
}

pub(crate) fn localhost_run_ssh_args(local_port: u16) -> Vec<String> {
    [
        "-T".to_string(),
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ConnectTimeout=15".to_string(),
        "-o".to_string(),
        "ConnectionAttempts=1".to_string(),
        "-o".to_string(),
        "ExitOnForwardFailure=yes".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=60".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=accept-new".to_string(),
        "-R".to_string(),
        format!("80:127.0.0.1:{local_port}"),
        "nokey@localhost.run".to_string(),
    ]
    .into_iter()
    .collect()
}

pub(crate) fn cloudflared_origin_registered(line: &str) -> bool {
    let line = line.to_ascii_lowercase();
    line.contains("registered tunnel connection")
        && !line.contains("unregistered tunnel connection")
}

pub(crate) fn cloudflared_origin_unregistered(line: &str) -> bool {
    line.to_ascii_lowercase()
        .contains("unregistered tunnel connection")
}

pub(crate) fn extract_public_https_url(line: &str) -> Option<String> {
    let start = line.find("https://")?;
    let candidate = line[start..]
        .split(|character: char| character.is_whitespace() || character.is_control())
        .next()?
        .trim_matches(|character: char| {
            matches!(character, '"' | '\'' | ',' | '.' | ';' | ')' | ']' | '}')
        });
    let authority = candidate.strip_prefix("https://")?.split('/').next()?;
    if authority.is_empty() || authority.contains('@') || authority.contains(':') {
        return None;
    }
    let host = authority.to_ascii_lowercase();
    if host == "admin.localhost.run" {
        return None;
    }
    let trusted = host.ends_with(".localhost.run")
        || host.ends_with(".lhr.life")
        || host.ends_with(".lhr.rocks")
        || host.ends_with(".trycloudflare.com");
    trusted.then(|| candidate.to_string())
}

pub(crate) fn public_tunnel_host(url: &str) -> Option<&str> {
    let authority = url.strip_prefix("https://")?.split('/').next()?;
    (!authority.is_empty() && !authority.contains('@') && !authority.contains(':'))
        .then_some(authority)
}

pub(crate) fn public_tunnel_is_resolvable(url: &str) -> bool {
    public_tunnel_host(url).is_some_and(|host| format!("{host}:443").to_socket_addrs().is_ok())
}
