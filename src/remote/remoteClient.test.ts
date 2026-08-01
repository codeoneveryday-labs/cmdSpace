import { describe, expect, it } from "vitest";
import { RemoteTerminalClient } from "./remoteClient";

class FakeSocket {
  static readonly OPEN = 1;
  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
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
});
