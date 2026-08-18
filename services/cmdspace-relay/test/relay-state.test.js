import assert from "node:assert/strict";
import test from "node:test";

import { RelayState, validateRelayRequest } from "../src/relay-state.js";

function fakeSocket() {
  return {
    sent: [],
    send(message) { this.sent.push(message); },
  };
}

test("validates only websocket upgrades to a bounded relay id", () => {
  assert.deepEqual(
    validateRelayRequest(new Request("https://relay.example/relay/desktop_01", {
      headers: { Upgrade: "websocket" },
    })),
    { relayId: "desktop_01" },
  );
  assert.equal(
    validateRelayRequest(new Request("https://relay.example/relay/desktop_01")),
    null,
  );
  assert.equal(
    validateRelayRequest(new Request("https://relay.example/relay/../private", {
      headers: { Upgrade: "websocket" },
    })),
    null,
  );
});

test("only the registered desktop credential can own the desktop role", () => {
  const relay = new RelayState();
  const desktop = fakeSocket();

  assert.equal(relay.admitDesktop(desktop, "desktop-secret"), "accepted");
  assert.equal(relay.admitDesktop(fakeSocket(), "wrong-secret"), "rejected");
  assert.equal(relay.desktop, desktop);
});

test("a matching desktop reconnect replaces the previous socket", () => {
  const relay = new RelayState();
  const first = { ...fakeSocket(), closed: false, close() { this.closed = true; } };
  const replacement = fakeSocket();
  relay.admitDesktop(first, "desktop-secret");

  assert.equal(relay.admitDesktop(replacement, "desktop-secret"), "accepted");
  assert.equal(first.closed, true);
  assert.equal(relay.desktop, replacement);
});

test("a desktop reconnect reopens existing device bridges without dropping the device", () => {
  const relay = new RelayState();
  const first = fakeSocket();
  const replacement = fakeSocket();
  const device = fakeSocket();

  relay.admitDesktop(first, "desktop-secret");
  const deviceId = relay.admitDevice(device);
  relay.disconnectDesktop(first);

  assert.equal(relay.desktop, null);
  assert.equal(relay.devices.get(deviceId), device);

  relay.admitDesktop(replacement, "desktop-secret");

  assert.deepEqual(replacement.sent, [{ type: "deviceOpen", connectionId: deviceId }]);
  assert.equal(relay.devices.get(deviceId), device);
});

test("device traffic reaches the desktop and desktop traffic reaches that device", () => {
  const relay = new RelayState();
  const desktop = fakeSocket();
  const device = fakeSocket();
  relay.admitDesktop(desktop, "desktop-secret");

  const deviceId = relay.admitDevice(device);
  relay.receiveFromDevice(deviceId, '{"version":3,"message":{"type":"ping"}}');
  relay.receiveFromDesktop(deviceId, '{"version":3,"message":{"type":"pong"}}');

  assert.deepEqual(desktop.sent, [
    { type: "deviceOpen", connectionId: deviceId },
    { type: "deviceFrame", connectionId: deviceId, payload: '{"version":3,"message":{"type":"ping"}}' },
  ]);
  assert.deepEqual(device.sent, [
    { type: "relayReady", connectionId: deviceId },
    '{"version":3,"message":{"type":"pong"}}',
  ]);
});

test("device admission reports an offline desktop without retaining device state", () => {
  const relay = new RelayState();
  const device = fakeSocket();

  assert.equal(relay.admitDevice(device), null);
  assert.deepEqual(device.sent, [{ type: "desktopOffline" }]);
  assert.equal(relay.devices.size, 0);
});
