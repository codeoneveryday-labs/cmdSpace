import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class FakeChannel<T> {
    onmessage: ((event: T) => void) | null = null;
  },
  invoke: mocks.invoke,
}));

import { proxyFetch } from "./proxyFetch";

describe("proxyFetch", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("forwards FormData with the generated multipart boundary", async () => {
    mocks.invoke.mockImplementation(
      (
        _command: string,
        args: {
          onEvent: { onmessage: ((event: unknown) => void) | null };
        },
      ) => {
        queueMicrotask(() => {
          args.onEvent.onmessage?.({
            kind: "headers",
            status: 200,
            headers: { "content-type": "application/json" },
          });
          args.onEvent.onmessage?.({
            kind: "chunk",
            bytes: Array.from(new TextEncoder().encode('{"text":"ok"}')),
          });
          args.onEvent.onmessage?.({ kind: "end" });
        });
        return Promise.resolve();
      },
    );

    const form = new FormData();
    form.append("audio", new Blob(["voice"], { type: "audio/webm" }), "voice.webm");
    const response = await proxyFetch("https://api.fish.audio/v1/asr", {
      method: "POST",
      headers: { Authorization: "Bearer fish_test" },
      body: form,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "ok" });

    const [, args] = mocks.invoke.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: number[] },
    ];
    expect(args.headers).toEqual({
      Authorization: "Bearer fish_test",
      "content-type": expect.stringMatching(/^multipart\/form-data; boundary=/),
    });
    const body = new TextDecoder().decode(Uint8Array.from(args.body));
    expect(body).toContain('name="audio"');
    expect(body).toContain('filename="voice.webm"');
  });
});
