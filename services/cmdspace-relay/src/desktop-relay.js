import { DurableObject } from "cloudflare:workers";

import { RelayState } from "./relay-state.js";

const encoder = new TextEncoder();

export class DesktopRelay extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.relay = new RelayState();
    this.sockets = new Map();

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (!attachment?.role) continue;
      const relaySocket = this.wrap(socket);
      if (attachment.role === "desktop") {
        this.relay.restoreDesktop(relaySocket);
      } else if (attachment.role === "device" && attachment.connectionId) {
        this.relay.restoreDevice(attachment.connectionId, relaySocket);
      }
    }
  }

  async fetch(request) {
    const relayId = new URL(request.url).pathname.split("/").at(-1);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ relayId });
    this.wrap(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    const relaySocket = this.wrap(socket);
    const attachment = socket.deserializeAttachment();
    if (!attachment?.role) {
      await this.admit(socket, relaySocket, message);
      return;
    }

    if (attachment.role === "device") {
      if (typeof message !== "string") {
        socket.close(1003, "relay accepts text frames only");
        return;
      }
      this.relay.receiveFromDevice(attachment.connectionId, message);
      return;
    }

    if (typeof message !== "string") {
      socket.close(1003, "relay control frames must be text");
      return;
    }
    this.handleDesktopFrame(message);
  }

  webSocketClose(socket, code, reason) {
    const attachment = socket.deserializeAttachment();
    this.sockets.delete(socket);
    if (attachment?.role === "device") {
      this.relay.closeDevice(attachment.connectionId);
    }
    if (attachment?.role === "desktop") {
      // A desktop relay connection is intentionally replaceable.  Devices
      // remain open while its native client reconnects, then the new desktop
      // socket receives a DeviceOpen for each existing device.
      this.relay.disconnectDesktop(relaySocket);
    }
    socket.close(code, reason);
  }

  async admit(socket, relaySocket, message) {
    if (typeof message !== "string") {
      socket.close(1003, "relay admission must be text");
      return;
    }
    let admission;
    try {
      admission = JSON.parse(message);
    } catch {
      socket.close(1008, "invalid relay admission");
      return;
    }
    if (
      admission?.version !== 1 ||
      !["desktop", "device"].includes(admission.role) ||
      admission.relayId !== socket.deserializeAttachment()?.relayId
    ) {
      socket.close(1008, "invalid relay admission");
      return;
    }
    if (admission.role === "desktop") {
      if (typeof admission.credential !== "string" || admission.credential.length < 32) {
        socket.close(1008, "desktop relay credential required");
        return;
      }
      const credentialHash = await hashCredential(admission.credential);
      const storedHash = await this.ctx.storage.get("desktopCredentialHash");
      if (storedHash && storedHash !== credentialHash) {
        socket.close(1008, "desktop relay credential rejected");
        return;
      }
      if (!storedHash) await this.ctx.storage.put("desktopCredentialHash", credentialHash);
      this.relay.desktopCredential = credentialHash;
      if (this.relay.admitDesktop(relaySocket, credentialHash) !== "accepted") {
        socket.close(1008, "desktop relay credential rejected");
        return;
      }
      socket.serializeAttachment({ role: "desktop", relayId: admission.relayId });
      relaySocket.send({ type: "relayReady" });
      return;
    }

    const connectionId = this.relay.admitDevice(relaySocket, crypto.randomUUID());
    if (!connectionId) {
      socket.close(1013, "desktop unavailable");
      return;
    }
    socket.serializeAttachment({ role: "device", connectionId, relayId: admission.relayId });
  }

  handleDesktopFrame(message) {
    let frame;
    try {
      frame = JSON.parse(message);
    } catch {
      return;
    }
    if (frame?.type === "heartbeat") {
      this.relay.desktop?.send({ type: "heartbeatAck" });
      return;
    }
    if (frame?.type === "deviceFrame" && typeof frame.connectionId === "string" && typeof frame.payload === "string") {
      this.relay.receiveFromDesktop(frame.connectionId, frame.payload);
    }
    if (frame?.type === "deviceClose" && typeof frame.connectionId === "string") {
      const device = this.relay.devices.get(frame.connectionId);
      device?.close(1000, "desktop closed device stream");
      this.relay.closeDevice(frame.connectionId);
    }
  }

  wrap(socket) {
    const existing = this.sockets.get(socket);
    if (existing) return existing;
    const wrapped = {
      socket,
      send(value) {
        socket.send(typeof value === "string" ? value : JSON.stringify(value));
      },
      close(code, reason) {
        socket.close(code, reason);
      },
    };
    this.sockets.set(socket, wrapped);
    return wrapped;
  }
}

async function hashCredential(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
