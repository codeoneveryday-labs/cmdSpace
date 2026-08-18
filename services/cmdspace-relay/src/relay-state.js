const relayIdPattern = /^[A-Za-z0-9_-]{1,96}$/;

export function validateRelayRequest(request) {
  const url = new URL(request.url);
  const relayId = url.pathname.match(/^\/relay\/([A-Za-z0-9_-]{1,96})$/)?.[1];
  if (
    request.method !== "GET" ||
    request.headers.get("Upgrade")?.toLowerCase() !== "websocket" ||
    !relayId ||
    !relayIdPattern.test(relayId)
  ) {
    return null;
  }
  return { relayId };
}

export class RelayState {
  constructor({ desktopCredential = null } = {}) {
    this.desktopCredential = desktopCredential;
    this.desktop = null;
    this.devices = new Map();
    this.nextDeviceNumber = 1;
  }

  admitDesktop(socket, credential) {
    if (!credential || (this.desktopCredential && credential !== this.desktopCredential)) {
      return "rejected";
    }
    this.desktopCredential ??= credential;
    this.desktop?.close?.(4001, "replaced by desktop reconnect");
    this.desktop = socket;
    for (const deviceId of this.devices.keys()) {
      this.desktop.send({ type: "deviceOpen", connectionId: deviceId });
    }
    return "accepted";
  }

  disconnectDesktop(socket) {
    if (this.desktop !== socket) return;
    this.desktop = null;
  }

  admitDevice(socket, deviceId = `device-${this.nextDeviceNumber++}`) {
    if (!this.desktop) {
      socket.send({ type: "desktopOffline" });
      return null;
    }
    this.devices.set(deviceId, socket);
    socket.send({ type: "relayReady", connectionId: deviceId });
    this.desktop.send({ type: "deviceOpen", connectionId: deviceId });
    return deviceId;
  }

  receiveFromDevice(deviceId, payload) {
    if (!this.devices.has(deviceId) || !this.desktop) return;
    this.desktop.send({ type: "deviceFrame", connectionId: deviceId, payload });
  }

  receiveFromDesktop(deviceId, payload) {
    this.devices.get(deviceId)?.send(payload);
  }

  closeDevice(deviceId) {
    if (!this.devices.delete(deviceId)) return;
    this.desktop?.send({ type: "deviceClose", connectionId: deviceId });
  }

  restoreDesktop(socket) {
    this.desktop = socket;
  }

  restoreDevice(deviceId, socket) {
    this.devices.set(deviceId, socket);
  }
}
