#![deny(clippy::expect_used, clippy::unwrap_used)]

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt::{Display, Formatter};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum NetErrorKind {
    EmptyUrl,
    InvalidUrl,
    SchemeNotAllowed,
    UserinfoNotAllowed,
    MissingHost,
    HostBlocked,
    DnsFailed,
    NoSafeAddresses,
    PrivateAddressBlocked,
    MethodInvalid,
    HeaderNotAllowed,
    HeaderInvalid,
    ClientBuildFailed,
    RequestFailed,
    ResponseReadFailed,
    StreamFailed,
}

/// Safe outbound network error exposed at the Tauri boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NetError {
    pub(crate) kind: NetErrorKind,
}

impl NetError {
    pub(crate) const fn new(kind: NetErrorKind) -> Self {
        Self { kind }
    }

    pub(crate) fn code(self) -> &'static str {
        match self.kind {
            NetErrorKind::EmptyUrl => "NET_URL_EMPTY",
            NetErrorKind::InvalidUrl => "NET_URL_INVALID",
            NetErrorKind::SchemeNotAllowed => "NET_SCHEME_NOT_ALLOWED",
            NetErrorKind::UserinfoNotAllowed => "NET_URL_USERINFO_NOT_ALLOWED",
            NetErrorKind::MissingHost => "NET_HOST_MISSING",
            NetErrorKind::HostBlocked => "NET_HOST_BLOCKED",
            NetErrorKind::DnsFailed => "NET_DNS_FAILED",
            NetErrorKind::NoSafeAddresses => "NET_NO_SAFE_ADDRESSES",
            NetErrorKind::PrivateAddressBlocked => "NET_PRIVATE_ADDRESS_BLOCKED",
            NetErrorKind::MethodInvalid => "NET_METHOD_INVALID",
            NetErrorKind::HeaderNotAllowed => "NET_HEADER_NOT_ALLOWED",
            NetErrorKind::HeaderInvalid => "NET_HEADER_INVALID",
            NetErrorKind::ClientBuildFailed => "NET_CLIENT_BUILD_FAILED",
            NetErrorKind::RequestFailed => "NET_REQUEST_FAILED",
            NetErrorKind::ResponseReadFailed => "NET_RESPONSE_READ_FAILED",
            NetErrorKind::StreamFailed => "NET_STREAM_FAILED",
        }
    }

    fn safe_message(self) -> &'static str {
        match self.kind {
            NetErrorKind::EmptyUrl => "network URL is empty",
            NetErrorKind::InvalidUrl => "network URL is invalid",
            NetErrorKind::SchemeNotAllowed => "network URL scheme is not allowed",
            NetErrorKind::UserinfoNotAllowed => "network URL userinfo is not allowed",
            NetErrorKind::MissingHost => "network URL host is missing",
            NetErrorKind::HostBlocked => "network host is blocked by policy",
            NetErrorKind::DnsFailed => "network DNS resolution failed",
            NetErrorKind::NoSafeAddresses => "network host has no safe addresses",
            NetErrorKind::PrivateAddressBlocked => {
                "network private address requires explicit opt-in"
            }
            NetErrorKind::MethodInvalid => "network method is invalid",
            NetErrorKind::HeaderNotAllowed => "network header is not allowed",
            NetErrorKind::HeaderInvalid => "network header is invalid",
            NetErrorKind::ClientBuildFailed => "network client could not be built",
            NetErrorKind::RequestFailed => "network request failed",
            NetErrorKind::ResponseReadFailed => "network response could not be read",
            NetErrorKind::StreamFailed => "network response stream failed",
        }
    }
}

impl Display for NetError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.safe_message())
    }
}

impl std::error::Error for NetError {}

impl Serialize for NetError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IpcError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.safe_message())?;
        state.end()
    }
}

impl From<NetError> for String {
    fn from(value: NetError) -> Self {
        value.to_string()
    }
}

pub type NetResult<T> = std::result::Result<T, NetError>;

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn network_errors_serialize_safe_namespaced_codes() {
        let value = serde_json::to_value(NetError::new(NetErrorKind::PrivateAddressBlocked))
            .expect("serialize network error");

        assert_eq!(value["code"], "NET_PRIVATE_ADDRESS_BLOCKED");
        assert_eq!(
            value["message"],
            "network private address requires explicit opt-in"
        );
    }
}
