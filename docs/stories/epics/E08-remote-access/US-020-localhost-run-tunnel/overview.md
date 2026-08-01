# Overview

## Current Behavior

Remote Access starts an authenticated HTTP/WebSocket server and provides a LAN
URL. Devices outside the host network cannot reach it without manual networking
configuration.

## Target Behavior

Enabling Remote Access also supervises a `localhost.run` SSH reverse tunnel.
Settings shows lifecycle state, promotes the public HTTPS URL when ready, and
retains the LAN URL as a fallback when the provider is unavailable.

## Affected Users

- Desktop users connecting to their host terminal from a phone or remote
  browser.

## Affected Product Docs

- `docs/product/remote-access.md`

## Non-Goals

- Running terminal processes on the phone.
- Replacing cmdSpace authentication with provider authentication.
- Supporting multiple tunnel providers in this story.
