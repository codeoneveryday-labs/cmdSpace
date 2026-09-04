import { Channel, invoke } from "@tauri-apps/api/core";

/** Streaming events emitted by the Rust `ai_http_stream` command. */
type AiStreamEvent =
  | { kind: "headers"; status: number; headers: Record<string, string> }
  | { kind: "chunk"; bytes: number[] }
  | { kind: "end" }
  | { kind: "error"; message: string };

type RequestHeaders = Record<string, string>;

function headerInitToRecord(
  init: HeadersInit | undefined,
): RequestHeaders | undefined {
  if (!init) return undefined;
  const out: RequestHeaders = {};
  if (init instanceof Headers) {
    init.forEach((value, key) => {
      out[key] = value;
    });
  } else if (Array.isArray(init)) {
    for (const [k, v] of init) out[k] = v;
  } else {
    for (const [k, v] of Object.entries(init)) out[k] = String(v);
  }
  return out;
}

type SerializedBody = {
  bytes: number[] | undefined;
  contentType: string | undefined;
};

async function bodyToBytes(
  body: BodyInit | null | undefined,
): Promise<SerializedBody> {
  if (body == null) return { bytes: undefined, contentType: undefined };
  if (typeof body === "string") {
    return {
      bytes: Array.from(new TextEncoder().encode(body)),
      contentType: undefined,
    };
  }
  if (body instanceof ArrayBuffer) {
    return {
      bytes: Array.from(new Uint8Array(body)),
      contentType: undefined,
    };
  }
  if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView;
    return {
      bytes: Array.from(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      ),
      contentType: undefined,
    };
  }
  if (body instanceof Blob) {
    return {
      bytes: Array.from(new Uint8Array(await body.arrayBuffer())),
      contentType: body.type || undefined,
    };
  }
  if (body instanceof FormData) {
    const request = new Request("https://cmdspace.invalid", {
      method: "POST",
      body,
    });
    return {
      bytes: Array.from(new Uint8Array(await request.arrayBuffer())),
      contentType: request.headers.get("content-type") ?? undefined,
    };
  }
  // FormData / URLSearchParams / ReadableStream — uncommon for AI SDK calls.
  const text = await new Response(body as BodyInit).text();
  return {
    bytes: Array.from(new TextEncoder().encode(text)),
    contentType: undefined,
  };
}

export function createProxyFetch(
  opts: { allowPrivateNetwork?: boolean } = {},
): typeof fetch {
  const allowPrivate = opts.allowPrivateNetwork === true;
  return async (input, init) => proxyFetchImpl(input, init, allowPrivate);
}

/** Backwards-compatible default — refuses private networks unless the caller
 *  explicitly opts in via {@link createProxyFetch}. */
export const proxyFetch: typeof fetch = (input, init) =>
  proxyFetchImpl(input, init, false);

async function proxyFetchImpl(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  allowPrivateNetwork: boolean,
): Promise<Response> {
  const url = input instanceof URL ? input.toString() : String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = headerInitToRecord(init?.headers) ?? {};
  const serializedBody = await bodyToBytes(init?.body);
  if (
    serializedBody.contentType &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["content-type"] = serializedBody.contentType;
  }

  const signal = init?.signal;
  if (signal?.aborted) {
    throw makeAbortError();
  }

  return new Promise<Response>((resolve, reject) => {
    let resolved = false;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null =
      null;
    let cancelled = false;

    const onAbort = () => {
      cancelled = true;
      if (!resolved) {
        reject(makeAbortError());
      } else if (streamController) {
        try {
          streamController.error(makeAbortError());
        } catch {
          /* already closed */
        }
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const channel = new Channel<AiStreamEvent>();
    channel.onmessage = (event) => {
      if (cancelled) return;
      switch (event.kind) {
        case "headers": {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
            cancel() {
              cancelled = true;
            },
          });
          resolved = true;
          resolve(
            new Response(stream, {
              status: event.status,
              headers: new Headers(event.headers),
            }),
          );
          break;
        }
        case "chunk": {
          streamController?.enqueue(Uint8Array.from(event.bytes));
          break;
        }
        case "end": {
          streamController?.close();
          break;
        }
        case "error": {
          if (!resolved) {
            reject(new Error(event.message));
          } else {
            streamController?.error(new Error(event.message));
          }
          break;
        }
      }
    };

    invoke("ai_http_stream", {
      url,
      method,
      headers,
      body: serializedBody.bytes,
      allowPrivateNetwork,
      onEvent: channel,
    }).catch((e) => {
      if (resolved) return; // headers already arrived; chunk-side error wins
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

function makeAbortError(): DOMException {
  return new DOMException("Request aborted", "AbortError");
}
