use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};

use super::error::{NetError, NetErrorKind, NetResult};

const HEADER_BLOCKLIST: &[&str] = &[
    "host",
    "content-length",
    "connection",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "transfer-encoding",
    "upgrade",
    "trailer",
    "expect",
];

fn is_blocked_host_name(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    matches!(
        host.as_str(),
        "metadata.google.internal" | "metadata" | "metadata.azure.com"
    )
}

fn ip_kind(ip: IpAddr) -> IpKind {
    match ip {
        IpAddr::V4(v) => {
            let o = v.octets();
            if v.is_link_local() {
                return IpKind::BlockedMetadata;
            }
            if v.is_loopback() || v.is_unspecified() || v.is_broadcast() || v.is_multicast() {
                return IpKind::Loopback;
            }
            if o[0] == 10
                || (o[0] == 172 && (16..=31).contains(&o[1]))
                || (o[0] == 192 && o[1] == 168)
                || (o[0] == 100 && (64..=127).contains(&o[1]))
                || (o[0] == 198 && (o[1] == 18 || o[1] == 19))
            {
                return IpKind::Private;
            }
            IpKind::Public
        }
        IpAddr::V6(v) => {
            if v.is_loopback() || v.is_unspecified() || v.is_multicast() {
                return IpKind::Loopback;
            }
            let segs = v.segments();
            if segs[0] == 0xfd00 && segs[1] == 0xec2 {
                return IpKind::BlockedMetadata;
            }
            if segs[0] & 0xffc0 == 0xfe80 {
                return IpKind::BlockedMetadata;
            }
            if segs[0] & 0xfe00 == 0xfc00 {
                return IpKind::Private;
            }
            IpKind::Public
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
enum IpKind {
    Public,
    Private,
    Loopback,
    BlockedMetadata,
}

/// Resolve a host once and classify every returned address so the caller can
/// pin the eventual HTTP client to the exact addresses that passed policy.
async fn resolve_and_classify(host: &str) -> NetResult<(IpKind, Vec<IpAddr>)> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok((ip_kind(ip), vec![ip]));
    }
    let host_owned = host.to_string();
    let lookup = tokio::task::spawn_blocking(move || {
        (host_owned.as_str(), 0u16)
            .to_socket_addrs()
            .map(|it| it.map(|a| a.ip()).collect::<Vec<_>>())
    })
    .await
    .map_err(|_| NetError::new(NetErrorKind::DnsFailed))?
    .map_err(|_| NetError::new(NetErrorKind::DnsFailed))?;
    if lookup.is_empty() {
        return Err(NetError::new(NetErrorKind::DnsFailed));
    }
    let mut worst = IpKind::Public;
    for ip in &lookup {
        let k = ip_kind(*ip);
        worst = match (worst, k) {
            (_, IpKind::BlockedMetadata) => IpKind::BlockedMetadata,
            (IpKind::BlockedMetadata, _) => IpKind::BlockedMetadata,
            (IpKind::Public, x) => x,
            (x, IpKind::Public) => x,
            (a, _) => a,
        };
    }
    Ok((worst, lookup))
}

pub(crate) fn validate_url(url: &str, allow_private: bool) -> NetResult<reqwest::Url> {
    let parsed = reqwest::Url::parse(url).map_err(|_| NetError::new(NetErrorKind::InvalidUrl))?;
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err(NetError::new(NetErrorKind::SchemeNotAllowed)),
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(NetError::new(NetErrorKind::UserinfoNotAllowed));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| NetError::new(NetErrorKind::MissingHost))?;
    if is_blocked_host_name(host) {
        return Err(NetError::new(NetErrorKind::HostBlocked));
    }
    let _ = allow_private;
    Ok(parsed)
}

pub(crate) async fn classify_and_collect_safe_ips(
    host: &str,
    allow_private: bool,
) -> NetResult<Vec<IpAddr>> {
    let (worst, ips) = resolve_and_classify(host).await?;
    match worst {
        IpKind::BlockedMetadata => return Err(NetError::new(NetErrorKind::HostBlocked)),
        IpKind::Loopback | IpKind::Private if !allow_private => {
            return Err(NetError::new(NetErrorKind::PrivateAddressBlocked));
        }
        _ => {}
    }
    let safe: Vec<IpAddr> = ips
        .into_iter()
        .filter(|ip| match ip_kind(*ip) {
            IpKind::BlockedMetadata => false,
            IpKind::Loopback | IpKind::Private => allow_private,
            IpKind::Public => true,
        })
        .collect();
    if safe.is_empty() {
        return Err(NetError::new(NetErrorKind::NoSafeAddresses));
    }
    Ok(safe)
}

pub(crate) fn sanitize_headers(headers: Option<HashMap<String, String>>) -> NetResult<HeaderMap> {
    let mut map = HeaderMap::new();
    let Some(headers) = headers else {
        return Ok(map);
    };
    for (key, value) in headers {
        let lower = key.to_ascii_lowercase();
        if HEADER_BLOCKLIST.contains(&lower.as_str()) {
            return Err(NetError::new(NetErrorKind::HeaderNotAllowed));
        }
        if value
            .as_bytes()
            .iter()
            .any(|byte| matches!(byte, 0 | b'\r' | b'\n'))
        {
            return Err(NetError::new(NetErrorKind::HeaderInvalid));
        }
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|_| NetError::new(NetErrorKind::HeaderInvalid))?;
        let header_value = HeaderValue::from_str(&value)
            .map_err(|_| NetError::new(NetErrorKind::HeaderInvalid))?;
        map.insert(name, header_value);
    }
    Ok(map)
}

pub(crate) fn build_safe_client(
    allow_private: bool,
    pinned: &[(String, Vec<IpAddr>)],
) -> NetResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder().connect_timeout(Duration::from_secs(10));
    // Pin reqwest's resolver to the addresses already classified above to
    // prevent a second DNS lookup from crossing the security policy.
    for (host, ips) in pinned {
        let addrs: Vec<SocketAddr> = ips.iter().map(|ip| SocketAddr::new(*ip, 0)).collect();
        if !addrs.is_empty() {
            builder = builder.resolve_to_addrs(host, &addrs);
        }
    }
    builder
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() > 10 {
                return attempt.error("too many redirects");
            }
            let next = attempt.url();
            match next.scheme() {
                "http" | "https" => {}
                _ => return attempt.stop(),
            }
            if !next.username().is_empty() || next.password().is_some() {
                return attempt.stop();
            }
            let Some(host) = next.host_str() else {
                return attempt.stop();
            };
            if is_blocked_host_name(host) {
                return attempt.stop();
            }
            if let Ok(ip) = host.parse::<IpAddr>() {
                let kind = ip_kind(ip);
                if kind == IpKind::BlockedMetadata {
                    return attempt.stop();
                }
                if !allow_private && matches!(kind, IpKind::Loopback | IpKind::Private) {
                    return attempt.stop();
                }
            } else if !allow_private {
                if let Some(previous) = attempt.previous().last() {
                    if previous.host_str() != Some(host) {
                        return attempt.stop();
                    }
                }
            }
            attempt.follow()
        }))
        .build()
        .map_err(|_| NetError::new(NetErrorKind::ClientBuildFailed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn metadata_ips_classified_as_blocked() {
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254))),
            IpKind::BlockedMetadata
        );
        assert_eq!(
            ip_kind("fd00:ec2::254".parse().unwrap()),
            IpKind::BlockedMetadata
        );
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(169, 254, 1, 1))),
            IpKind::BlockedMetadata
        );
        assert_eq!(ip_kind("fe80::1".parse().unwrap()), IpKind::BlockedMetadata);
    }

    #[test]
    fn private_ips_classified_correctly() {
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))),
            IpKind::Private
        );
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))),
            IpKind::Private
        );
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))),
            IpKind::Private
        );
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(100, 64, 0, 1))),
            IpKind::Private
        );
    }

    #[test]
    fn loopback_classified_as_loopback() {
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))),
            IpKind::Loopback
        );
        assert_eq!(ip_kind("::1".parse().unwrap()), IpKind::Loopback);
    }

    #[test]
    fn public_ips_classified_as_public() {
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))),
            IpKind::Public
        );
        assert_eq!(
            ip_kind(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))),
            IpKind::Public
        );
    }

    #[test]
    fn validate_url_blocks_userinfo_and_metadata_hostnames() {
        assert!(validate_url("http://user:pass@example.com/", true).is_err());
        assert!(validate_url("http://metadata.google.internal/", true).is_err());
        assert!(validate_url("http://metadata/", true).is_err());
        assert!(validate_url("http://metadata.azure.com/", true).is_err());
    }

    #[test]
    fn validate_url_rejects_non_http_schemes() {
        assert!(validate_url("ftp://example.com/", true).is_err());
        assert!(validate_url("file:///etc/passwd", true).is_err());
        assert!(validate_url("javascript:alert(1)", true).is_err());
    }

    #[test]
    fn security_errors_expose_stable_codes_without_host_details() {
        let invalid = validate_url("ftp://example.com/", true).expect_err("scheme must fail");
        let invalid_json = serde_json::to_value(invalid).expect("serialize invalid scheme");
        assert_eq!(invalid_json["code"], "NET_SCHEME_NOT_ALLOWED");

        let blocked = validate_url("http://metadata.google.internal/", true)
            .expect_err("metadata host must fail");
        let blocked_json = serde_json::to_value(blocked).expect("serialize blocked host");
        assert_eq!(blocked_json["code"], "NET_HOST_BLOCKED");
        assert!(!blocked_json["message"]
            .as_str()
            .expect("serialized message")
            .contains("metadata"));
    }

    #[test]
    fn sanitize_headers_blocks_crlf_and_hop_by_hop_headers() {
        let mut headers = HashMap::new();
        headers.insert("X-Foo".to_string(), "bar\r\nX-Evil: yes".to_string());
        assert!(sanitize_headers(Some(headers)).is_err());
        for hop in [
            "host",
            "content-length",
            "connection",
            "proxy-authorization",
        ] {
            let mut headers = HashMap::new();
            headers.insert(hop.to_string(), "value".to_string());
            assert!(
                sanitize_headers(Some(headers)).is_err(),
                "expected {hop} to be rejected"
            );
        }
    }
}
