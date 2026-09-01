use std::net::{IpAddr, UdpSocket};

pub fn lan_ip_addr() -> Option<IpAddr> {
    interface_lan_ip().or_else(route_lan_ip)
}

pub(super) fn route_lan_ip() -> Option<IpAddr> {
    UdpSocket::bind(("0.0.0.0", 0))
        .and_then(|socket| {
            let _ = socket.connect(("8.8.8.8", 80));
            socket.local_addr()
        })
        .map(|addr| addr.ip())
        .ok()
        .and_then(|address| select_lan_ip([address]))
}

pub fn select_lan_ip(candidates: impl IntoIterator<Item = IpAddr>) -> Option<IpAddr> {
    let mut public_candidate = None;
    for candidate in candidates {
        let IpAddr::V4(candidate) = candidate else {
            continue;
        };
        if candidate.is_unspecified()
            || candidate.is_loopback()
            || candidate.is_link_local()
            || candidate.is_multicast()
        {
            continue;
        }
        if candidate.is_private() {
            return Some(IpAddr::V4(candidate));
        }
        public_candidate.get_or_insert(IpAddr::V4(candidate));
    }
    public_candidate
}

#[cfg(unix)]
fn interface_lan_ip() -> Option<IpAddr> {
    struct InterfaceList(*mut libc::ifaddrs);

    impl Drop for InterfaceList {
        fn drop(&mut self) {
            // SAFETY: `self.0` is the exact list returned by `getifaddrs` and this
            // RAII owner is created only after that call succeeds.
            unsafe { libc::freeifaddrs(self.0) };
        }
    }

    let mut head = std::ptr::null_mut();
    // SAFETY: `head` is a valid out-pointer and the successful result is owned
    // immediately by `InterfaceList`, which frees it on every return path.
    if unsafe { libc::getifaddrs(&mut head) } != 0 || head.is_null() {
        return None;
    }
    let interfaces = InterfaceList(head);
    let mut cursor = interfaces.0;
    let mut candidates = Vec::new();
    while !cursor.is_null() {
        // SAFETY: every node belongs to the live `InterfaceList`; `ifa_next` is
        // traversed only until the documented null terminator.
        let interface = unsafe { &*cursor };
        if !interface.ifa_addr.is_null()
            && interface.ifa_flags & libc::IFF_UP as u32 != 0
            // SAFETY: the pointer was checked for null and the family field is
            // common to all sockaddr variants.
            && unsafe { (*interface.ifa_addr).sa_family as i32 } == libc::AF_INET
        {
            // SAFETY: AF_INET above guarantees this sockaddr is a sockaddr_in.
            let socket = unsafe { &*(interface.ifa_addr.cast::<libc::sockaddr_in>()) };
            candidates.push(IpAddr::V4(std::net::Ipv4Addr::from(
                socket.sin_addr.s_addr.to_ne_bytes(),
            )));
        }
        cursor = interface.ifa_next;
    }
    select_lan_ip(candidates)
}

#[cfg(windows)]
fn interface_lan_ip() -> Option<IpAddr> {
    use windows_sys::Win32::{
        Foundation::{ERROR_BUFFER_OVERFLOW, NO_ERROR},
        NetworkManagement::{
            IpHelper::{
                GetAdaptersAddresses, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_DNS_SERVER,
                GAA_FLAG_SKIP_FRIENDLY_NAME, GAA_FLAG_SKIP_MULTICAST, IP_ADAPTER_ADDRESSES_LH,
            },
            Ndis::IfOperStatusUp,
        },
        Networking::WinSock::{AF_INET, SOCKADDR_IN},
    };

    const INITIAL_BUFFER_BYTES: usize = 15 * 1024;
    let word_size = std::mem::size_of::<usize>();
    let mut byte_capacity = INITIAL_BUFFER_BYTES;
    for _ in 0..2 {
        let words = byte_capacity.div_ceil(word_size);
        let mut buffer = vec![0_usize; words];
        let mut required_bytes = (buffer.len() * word_size) as u32;
        let flags = GAA_FLAG_SKIP_ANYCAST
            | GAA_FLAG_SKIP_MULTICAST
            | GAA_FLAG_SKIP_DNS_SERVER
            | GAA_FLAG_SKIP_FRIENDLY_NAME;
        // SAFETY: the usize-backed buffer is suitably aligned and writable for
        // `required_bytes`; all pointers derived from it stay within this call's
        // buffer lifetime.
        let result = unsafe {
            GetAdaptersAddresses(
                AF_INET as u32,
                flags,
                std::ptr::null(),
                buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>(),
                &mut required_bytes,
            )
        };
        if result == ERROR_BUFFER_OVERFLOW {
            byte_capacity = required_bytes as usize;
            continue;
        }
        if result != NO_ERROR {
            return None;
        }

        let mut candidates = Vec::new();
        let mut adapter = buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
        while !adapter.is_null() {
            // SAFETY: successful `GetAdaptersAddresses` populated a linked list
            // entirely inside the still-live buffer.
            let current = unsafe { &*adapter };
            if current.OperStatus == IfOperStatusUp {
                let mut unicast = current.FirstUnicastAddress;
                while !unicast.is_null() {
                    // SAFETY: each unicast node belongs to the current adapter's
                    // list inside the same live API buffer.
                    let address = unsafe { &*unicast };
                    let socket = address.Address.lpSockaddr;
                    if !socket.is_null()
                        // SAFETY: `socket` is non-null and sockaddr family is the
                        // common prefix for every socket address variant.
                        && unsafe { (*socket).sa_family } == AF_INET
                    {
                        // SAFETY: AF_INET above guarantees a SOCKADDR_IN value;
                        // reading the byte union does not outlive the API buffer.
                        let octets =
                            unsafe { (*(socket.cast::<SOCKADDR_IN>())).sin_addr.S_un.S_un_b };
                        candidates.push(IpAddr::V4(std::net::Ipv4Addr::new(
                            octets.s_b1,
                            octets.s_b2,
                            octets.s_b3,
                            octets.s_b4,
                        )));
                    }
                    unicast = address.Next;
                }
            }
            adapter = current.Next;
        }
        return select_lan_ip(candidates);
    }
    None
}

#[cfg(not(any(unix, windows)))]
fn interface_lan_ip() -> Option<IpAddr> {
    None
}
