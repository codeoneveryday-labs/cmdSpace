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
