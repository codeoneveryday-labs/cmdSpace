import { invoke } from "@tauri-apps/api/core";

export type RemoteTunnelState =
  | "starting"
  | "ready"
  | "degraded"
  | "error"
  | "stopped";

export type RemoteAccessStatus = {
  enabled: boolean;
  url: string;
  lanUrl: string;
  publicUrl?: string;
  port: number;
  tunnelState: RemoteTunnelState;
  tunnelError?: string;
  bootstrapSecret?: string;
};

export type RemoteDevicePairingStatus = {
  secret: string;
  expiresAt: number;
  url: string;
};

export type RemotePairedDeviceStatus = {
  id: string;
  displayName: string;
  revoked: boolean;
};

function withRemoteTimeout(request: Promise<RemoteAccessStatus>) {
  return Promise.race([
    request,
    new Promise<RemoteAccessStatus>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Remote access backend did not respond.")),
        3000,
      );
    }),
  ]);
}

export function remoteAccessStatus() {
  return withRemoteTimeout(invoke<RemoteAccessStatus>("remote_access_status"));
}

export function remoteAccessStart() {
  return withRemoteTimeout(invoke<RemoteAccessStatus>("remote_access_start"));
}

export function remoteAccessStop() {
  return withRemoteTimeout(invoke<RemoteAccessStatus>("remote_access_stop"));
}

export function remoteAccessResetPassword() {
  return withRemoteTimeout(
    invoke<RemoteAccessStatus>("remote_access_reset_password"),
  );
}

export function remoteDevicePairingStart(displayName = "cmdSpace iOS device") {
  return invoke<RemoteDevicePairingStatus>("remote_device_pairing_start", {
    displayName,
  });
}

export function remoteDeviceList() {
  return invoke<RemotePairedDeviceStatus[]>("remote_device_list");
}

export function remoteDeviceRevoke(deviceId: string) {
  return invoke<RemotePairedDeviceStatus[]>("remote_device_revoke", { deviceId });
}
