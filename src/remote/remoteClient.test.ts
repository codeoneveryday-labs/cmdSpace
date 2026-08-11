import { describe, expect, it } from "vitest";
import { RemoteTerminalClient } from "./remoteClient";

class FakeSocket {
  static readonly OPEN = 1;
  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  closeCalls = 0;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
    this.closeCalls += 1;
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify({ version: 2, message }) } as MessageEvent<string>);
  }
}

describe("RemoteTerminalClient", () => {
  it("uses one socket for session metadata and terminal output", () => {
    const sockets: FakeSocket[] = [];
    const client = new RemoteTerminalClient({
      token: "token",
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const output: string[] = [];

    client.connect();
    expect(client.createSession("/tmp/project")).toBe(true);
    client.subscribeTerminal(7, (data) => output.push(data));
    client.listSessions();
    sockets[0]?.receive({ type: "hello", authenticated: false, runtimeId: 1 });
    sockets[0]?.receive({ type: "authenticated" });
    expect(client.createSession("/tmp/project")).toBe(true);
    client.sendInput(7, "x");
    sockets[0]?.receive({ type: "output", sessionId: 7, sequence: 1, data: "hello" });
    sockets[0]?.receive({ type: "output", sessionId: 7, sequence: 1, data: "duplicate" });

    expect(sockets).toHaveLength(1);
    expect(output).toEqual(["hello"]);
    const messages = sockets[0]!.sent.map((value) => JSON.parse(value).message);
    expect(messages).toContainEqual({ type: "auth", token: "token" });
    expect(messages).toContainEqual({ type: "createSession", cwd: "/tmp/project" });
    expect(messages).toContainEqual({ type: "attach", sessionId: 7, after: 0 });
    expect(messages).toContainEqual({ type: "listSessions" });
    expect(messages).toContainEqual({ type: "input", sessionId: 7, data: "x" });
  });

  it("replays a session from the beginning after the remote runtime restarts", () => {
    const sockets: FakeSocket[] = [];
    const client = new RemoteTerminalClient({
      token: "token",
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });

    client.connect();
    client.subscribeTerminal(7, () => {});
    sockets[0]?.receive({ type: "hello", authenticated: false, runtimeId: 1 });
    sockets[0]?.receive({ type: "authenticated" });
    sockets[0]?.receive({ type: "output", sessionId: 7, sequence: 7, data: "old output" });
    sockets[0]?.receive({ type: "hello", authenticated: false, runtimeId: 2 });
    sockets[0]?.receive({ type: "authenticated" });

    const messages = sockets[0]!.sent.map((value) => JSON.parse(value).message);
    const attachments = messages.filter((message) => message.type === "attach");
    expect(attachments[attachments.length - 1]).toEqual({
      type: "attach",
      sessionId: 7,
      after: 0,
    });
  });

  it("keeps connect and dispose idempotent across repeated lifecycle edges", () => {
    const sockets: FakeSocket[] = [];
    const client = new RemoteTerminalClient({
      token: "token",
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });

    client.connect();
    client.connect();
    client.dispose();
    client.dispose();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.closeCalls).toBe(1);
    expect(client.createSession("/tmp/project")).toBe(false);
  });

  it("cleans up terminal listeners after unsubscribe and detaches the previous session", () => {
    const sockets: FakeSocket[] = [];
    const client = new RemoteTerminalClient({
      token: "token",
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const firstSessionOutput: string[] = [];
    const secondSessionOutput: string[] = [];

    client.connect();
    sockets[0]?.receive({ type: "hello", authenticated: false, runtimeId: 1 });
    sockets[0]?.receive({ type: "authenticated" });
    const unsubscribeFirst = client.subscribeTerminal(7, (data) => firstSessionOutput.push(data));
    client.subscribeTerminal(8, (data) => secondSessionOutput.push(data));
    unsubscribeFirst();
    sockets[0]?.receive({ type: "output", sessionId: 7, sequence: 1, data: "stale" });
    sockets[0]?.receive({ type: "output", sessionId: 8, sequence: 1, data: "fresh" });

    expect(firstSessionOutput).toEqual([]);
    expect(secondSessionOutput).toEqual(["fresh"]);
    const messages = sockets[0]!.sent.map((value) => JSON.parse(value).message);
    expect(messages).toContainEqual({ type: "attach", sessionId: 7, after: 0 });
    expect(messages).toContainEqual({ type: "detach", sessionId: 7 });
    expect(messages[messages.length - 1]).toEqual({
      type: "attach",
      sessionId: 8,
      after: 0,
    });
  });

  it("propagates authentication errors before the session is authorized", () => {
    const sockets: FakeSocket[] = [];
    let unauthorizedCount = 0;
    const client = new RemoteTerminalClient({
      token: "token",
      onUnauthorized: () => {
        unauthorizedCount += 1;
      },
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });

    client.connect();
    sockets[0]?.receive({ type: "hello", authenticated: false, runtimeId: 1 });
    sockets[0]?.receive({
      type: "error",
      code: "unauthorized",
      message: "bad token",
      retryable: false,
    });
    sockets[0]?.receive({ type: "authenticated" });
    sockets[0]?.receive({
      type: "error",
      code: "session-missing",
      message: "gone",
      retryable: true,
    });

    expect(unauthorizedCount).toBe(1);
  });
});
