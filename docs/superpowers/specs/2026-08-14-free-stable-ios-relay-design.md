# Free stable relay for iOS remote access

**Status:** Approved for implementation.

## Outcome

An iPhone can reach its paired cmdSpace desktop from a different network
without port-forwarding, a paid server, or a QR code that becomes invalid when
an ephemeral tunnel reconnects. The relay endpoint is stable. Desktop remains
the authority for pairing, capabilities, workspaces, terminals, and PTY data.

## Scope

- Native iOS device protocol only (`DeviceClientMessage` / v3).
- A Cloudflare Worker plus one Durable Object per desktop identity.
- Desktop outbound WebSocket connection, iOS relay connection, QR payload,
  reconnect/offline UI, and automated tests.

The browser v2 remote endpoint, LAN transport, desktop workspace state, and
mobile-workspace ownership model are unchanged.

## Architecture

```text
iPhone ── WSS ──┐
                │ Cloudflare Durable Object: desktop relay room
Mac ── WSS ─────┘

Mac's existing device endpoint
  → pairing / challenge / capability enforcement / PTY runtime
```

The Worker exposes a fixed `workers.dev` hostname. A Durable Object is keyed
by a stable desktop relay ID, not by a temporary tunnel hostname. It holds at
most one active desktop socket and the paired iOS sockets for that desktop.
It forwards protocol frames between them and retains no terminal content,
workspace records, device keys, or session history.

The desktop opens an outbound WSS socket on startup and reconnects with
bounded exponential backoff. The iOS client connects to the same relay ID.
When either side is absent, the relay reports an explicit offline state rather
than silently routing to a stale tunnel address.

## Pairing and authority

The QR changes from `temporary tunnel URL + grant` to:

- fixed relay base URL;
- opaque desktop relay ID;
- one-time, expiring desktop-issued pairing grant; and
- the existing host identity/fingerprint material.

The Worker must not create credentials, decide whether a device may attach,
or inspect application messages for authorization. Those decisions continue
to occur at the desktop through the existing `PairDevice`,
`AuthenticateDevice`, and capability checks. A relay admission handshake
prevents a random client that merely guesses a relay ID from claiming the
desktop role or indefinitely occupying a socket slot.

The initial version provides encrypted transport to Cloudflare and does not
persist frame payloads. It does **not** claim end-to-end payload encryption
from iPhone to desktop; that would be a separately designed protocol layer.

## User-visible behavior

- Successful scan pairs once. Future reconnects reuse the fixed relay URL.
- Home shows **Desktop connected** while the desktop socket is present.
- If the Mac sleeps, quits, or loses internet, Home shows a recoverable
  **Desktop unavailable** state and disables workspace entry.
- Once the Mac reconnects, iOS can reconnect without rescanning a QR code.
- Revocation still removes the paired iOS identity at the desktop; the relay
  cannot bypass it.

## Failure and recovery

| Condition | Required result |
| --- | --- |
| Worker/relay unavailable | Retry with capped exponential backoff; surface retryable offline state. |
| Mac offline | Keep mobile workspace metadata locally visible if desired, but lock terminal and desktop-backed actions. |
| iPhone backgrounded | Close its relay socket; reconnect with the existing device authentication flow on foreground. |
| QR grant expired | Show pairing-expired and require a new QR. |
| Relay deploy/config fails | Preserve current LAN/tunnel fallback behind an explicit transport state; never overwrite a working saved pairing with a transient endpoint. |

## Data and secrets

- The Worker configuration contains only public binding names and a current
  compatibility date; no token, grant, or desktop private material is checked
  into git.
- Cloudflare deployment authentication stays in Wrangler's local credential
  store.
- Desktop persists its relay identity and any relay-admission material using
  the existing protected desktop settings/storage path.
- iOS keeps its device signing key in Keychain, as it does today.

## Verification

1. Worker tests: admission, single-desktop ownership, forwarding, offline
   response, and reconnect replacement.
2. Rust tests: fixed pairing payload parsing and desktop relay reconnect state.
3. Swift tests: QR parsing, saved relay endpoint, offline and reconnected UI
   transitions.
4. Local integration: Worker local dev + desktop + iOS Simulator, then deploy
   to the authenticated free Cloudflare account.
5. Manual proof: connect iPhone from a different network, sleep/restart Mac,
   verify offline behavior and automatic recovery without a new QR.

## Cost and operational limits

The target is a personal/development deployment on Cloudflare's Free plan.
Free-tier limits are an operational constraint, not a guarantee of unlimited
production capacity. The product must show a clear unavailable/retry state if
the relay cannot be reached or Cloudflare rejects a request.

## Explicit non-goals

- No paid VPS, custom domain, router configuration, or public inbound port.
- No storage or replay of terminal output in the relay.
- No migration of browser v2 remote access in this slice.
- No attempt to repair terminal cell-grid rendering; that is independent of
  stable networking transport.
