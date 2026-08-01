export const REMOTE_PROTOCOL_VERSION = 2;

export type RemoteClientMessage =
  | { type: "auth"; token: string }
  | { type: "listSessions" }
  | { type: "createSession"; cwd?: string | null }
  | { type: "attach"; sessionId: number; after: number }
  | { type: "detach"; sessionId: number }
  | { type: "input"; sessionId: number; data: string }
  | { type: "resize"; sessionId: number; cols: number; rows: number }
  | { type: "close"; sessionId: number }
  | { type: "ping" };

export type RemoteProtocolSession = {
  id: number;
  title: string;
  cwd: string | null;
  agent: string | null;
  attached: boolean;
};

export type RemoteServerMessage =
  | { type: "hello"; authenticated: boolean; runtimeId: number }
  | { type: "authenticated" }
  | { type: "sessions"; sessions: RemoteProtocolSession[] }
  | { type: "snapshot"; sessionId: number; sequence: number; data: string }
  | { type: "output"; sessionId: number; sequence: number; data: string }
  | { type: "exit"; sessionId: number; code: number | null }
  | { type: "error"; code: string; message: string; retryable: boolean }
  | { type: "pong" };

export type RemoteClientEnvelope = {
  version: typeof REMOTE_PROTOCOL_VERSION;
  message: RemoteClientMessage;
};

export type RemoteServerEnvelope = {
  version: typeof REMOTE_PROTOCOL_VERSION;
  message: RemoteServerMessage;
};

export function encodeRemoteClientMessage(message: RemoteClientMessage): string {
  const envelope: RemoteClientEnvelope = {
    version: REMOTE_PROTOCOL_VERSION,
    message,
  };
  return JSON.stringify(envelope);
}

export function decodeRemoteServerEnvelope(input: string): RemoteServerEnvelope {
  const parsed: unknown = JSON.parse(input);
  if (!isRecord(parsed) || parsed.version !== REMOTE_PROTOCOL_VERSION) {
    const version = isRecord(parsed) ? String(parsed.version) : "unknown";
    throw new Error(`unsupported remote protocol version: ${version}`);
  }

  if (!isRecord(parsed.message) || typeof parsed.message.type !== "string") {
    throw new Error("invalid remote protocol message");
  }

  return {
    version: REMOTE_PROTOCOL_VERSION,
    message: parsed.message as RemoteServerMessage,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
