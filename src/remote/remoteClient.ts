import {
  decodeRemoteServerEnvelope,
  encodeRemoteClientMessage,
  type RemoteClientMessage,
  type RemoteProtocolSession,
  type RemoteServerMessage,
} from "./protocol";

type SocketFactory = (url: string) => WebSocket;
type TerminalListener = (data: string, sequence: number) => void;
type MessageListener = (message: RemoteServerMessage) => void;

const REMOTE_PING_INTERVAL_MS = 20_000;
const MAX_PENDING_MESSAGES = 256;

type RemoteTerminalClientOptions = {
  token: string;
  url?: string;
  socketFactory?: SocketFactory;
  onUnauthorized?: () => void;
};

function defaultSocketUrl() {
  if (typeof window === "undefined") return "ws://localhost/api/remote/ws";
  const url = new URL("/api/remote/ws", window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export class RemoteTerminalClient {
  private readonly token: string;
  private readonly url: string;
  private readonly socketFactory: SocketFactory;
  private readonly onUnauthorized?: () => void;
  private socket: WebSocket | null = null;
  private authenticated = false;
  private disposed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private activeSessionId: number | null = null;
  private terminalListeners = new Map<number, Set<TerminalListener>>();
  private messageListeners = new Set<MessageListener>();
  private lastSequences = new Map<number, number>();
  private listRequested = false;
  private pendingMessages: RemoteClientMessage[] = [];
  private runtimeId: number | null = null;

  constructor(options: RemoteTerminalClientOptions) {
    this.token = options.token;
    this.url = options.url ?? defaultSocketUrl();
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
    this.onUnauthorized = options.onUnauthorized;
  }

  connect() {
    if (this.disposed || this.socket) return;
    const socket = this.socketFactory(this.url);
    this.socket = socket;
    socket.onmessage = (event) => this.receive(String(event.data));
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.authenticated = false;
      this.stopPing();
      if (!this.disposed) this.scheduleReconnect();
    };
  }

  subscribeMessages(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  subscribeTerminal(sessionId: number, listener: TerminalListener) {
    let listeners = this.terminalListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.terminalListeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    if (this.activeSessionId !== null && this.activeSessionId !== sessionId) {
      this.send({ type: "detach", sessionId: this.activeSessionId });
    }
    this.activeSessionId = sessionId;
    this.attachActiveSession();
    return () => {
      const current = this.terminalListeners.get(sessionId);
      current?.delete(listener);
      if (current?.size === 0) this.terminalListeners.delete(sessionId);
    };
  }

  listSessions() {
    this.listRequested = true;
    if (this.authenticated) this.send({ type: "listSessions" });
  }

  createSession(cwd: string) {
    return this.send({ type: "createSession", cwd });
  }

  sendInput(sessionId: number, data: string) {
    this.send({ type: "input", sessionId, data });
  }

  resize(sessionId: number, cols: number, rows: number) {
    this.send({ type: "resize", sessionId, cols, rows });
  }

  closeSession(sessionId: number) {
    this.send({ type: "close", sessionId });
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.terminalListeners.clear();
    this.messageListeners.clear();
  }

  private receive(input: string) {
    let message: RemoteServerMessage;
    try {
      message = decodeRemoteServerEnvelope(input).message;
    } catch (error) {
      console.warn("remote message rejected", error);
      return;
    }
    if (message.type === "hello") {
      this.authenticated = false;
      if (this.runtimeId !== null && this.runtimeId !== message.runtimeId) {
        this.lastSequences.clear();
      }
      this.runtimeId = message.runtimeId;
      this.send({ type: "auth", token: this.token }, true);
      return;
    }
    if (message.type === "authenticated") {
      this.authenticated = true;
      this.reconnectAttempt = 0;
      this.attachActiveSession();
      if (this.listRequested) this.send({ type: "listSessions" });
      this.flushPendingMessages();
      this.startPing();
    } else if (message.type === "snapshot" || message.type === "output") {
      const last = this.lastSequences.get(message.sessionId) ?? 0;
      if (message.sequence <= last) return;
      this.lastSequences.set(message.sessionId, message.sequence);
      for (const listener of this.terminalListeners.get(message.sessionId) ?? []) {
        listener(message.data, message.sequence);
      }
    } else if (message.type === "error" && !this.authenticated) {
      this.onUnauthorized?.();
    }
    for (const listener of this.messageListeners) listener(message);
  }

  private attachActiveSession() {
    if (!this.authenticated || this.activeSessionId === null) return;
    this.send({
      type: "attach",
      sessionId: this.activeSessionId,
      after: this.lastSequences.get(this.activeSessionId) ?? 0,
    });
  }

  private send(message: RemoteClientMessage, beforeAuthentication = false) {
    if (!beforeAuthentication && (!this.socket || this.socket.readyState !== 1 || !this.authenticated)) {
      if (!this.disposed && this.pendingMessages.length < MAX_PENDING_MESSAGES) {
        this.pendingMessages.push(message);
      }
      return !this.disposed;
    }
    if (!this.socket || this.socket.readyState !== 1) return false;
    this.socket.send(encodeRemoteClientMessage(message));
    return true;
  }

  private flushPendingMessages() {
    if (!this.socket || this.socket.readyState !== 1 || !this.authenticated) return;
    const pending = this.pendingMessages;
    this.pendingMessages = [];
    for (const message of pending) {
      this.socket.send(encodeRemoteClientMessage(message));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: "ping" }), REMOTE_PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer === null) return;
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.disposed) return;
    const delay = Math.min(500 * 2 ** this.reconnectAttempt, 8_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export type { RemoteProtocolSession };
