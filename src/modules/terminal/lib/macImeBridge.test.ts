import { beforeEach, describe, expect, it, vi } from "vitest";
import * as macImeBridge from "./macImeBridge";

type MacImeBridgeModule = typeof macImeBridge & {
  normalizeMacTerminalInput?: (value: string) => string;
};

describe("normalizeMacTerminalInput", () => {
  it("turns corrupted C1 control runs into a shell word separator", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize).toBeTypeOf("function");
    expect(normalize?.("mcli\u0083\u0080status")).toBe("mcli status");
  });

  it("preserves valid terminal input", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize?.("mcli status\r")).toBe("mcli status\r");
  });

  it("turns a corrupted no-break space into a shell word separator", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    expect(normalize?.("git clone\u00a0https://example.com/repo.git")).toBe(
      "git clone https://example.com/repo.git",
    );
  });

  it("normalizes C1 and regular spaces identically so a follow-up keystroke never diffs into a spurious DEL", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;

    // "mcli " as stored by WebKit (space arrives as C1 0x83) then a real space
    const from = normalize?.("mcli\u0083") ?? "?";
    const to = normalize?.("mcli ") ?? "?";
    expect(from).toBe("mcli ");
    expect(to).toBe(from);
  });

  it("normalizes space lookalikes but not a plain space", () => {
    const normalize = (macImeBridge as MacImeBridgeModule)
      .normalizeMacTerminalInput;
    expect(normalize?.("\u0083")).toBe(" ");
    expect(normalize?.("\u00a0")).toBe(" ");
    expect(normalize?.(" ")).toBe(" ");
  });
});

type FakeTextarea = {
  value: string;
  addEventListener: (name: string, cb: (event: unknown) => void) => void;
  fire: (name: string, event: Record<string, unknown>) => void;
  dispatchEvent: (event: { type: string; isTrusted?: boolean }) => boolean;
};

type FakeWindow = {
  addEventListener: (name: string, cb: () => void) => void;
  removeEventListener: (name: string, cb: () => void) => void;
  fire: (name: string) => void;
};

function createFakeWindow(): FakeWindow {
  const listeners = new Map<string, Array<() => void>>();
  return {
    addEventListener: (name, cb) => {
      const arr = listeners.get(name) ?? [];
      arr.push(cb);
      listeners.set(name, arr);
    },
    removeEventListener: (name, cb) => {
      const arr = listeners.get(name) ?? [];
      listeners.set(name, arr.filter((listener) => listener !== cb));
    },
    fire: (name) => {
      for (const cb of listeners.get(name) ?? []) cb();
    },
  };
}

function createFakeTextarea(ownerWindow?: FakeWindow) {
  const listeners = new Map<string, Array<(e: unknown) => void>>();
  const textarea = {
    value: "",
    ownerDocument: ownerWindow ? { defaultView: ownerWindow } : undefined,
    addEventListener: (name: string, cb: (e: unknown) => void) => {
      const arr = listeners.get(name) ?? [];
      arr.push(cb);
      listeners.set(name, arr);
    },
    fire: (name: string, event: Record<string, unknown>) => {
      for (const cb of listeners.get(name) ?? []) {
        cb({ stopImmediatePropagation: () => undefined, ...event });
      }
    },
    dispatchEvent: (event: { type: string; isTrusted?: boolean }) => {
      for (const cb of listeners.get(event.type) ?? []) cb(event);
      return true;
    },
  };
  return textarea as FakeTextarea & { value: string };
}

describe("attachMacImeBridge focus resync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("does not emit spurious DELs when typing after a window blur cleared the textarea", async () => {
    vi.stubGlobal("navigator", { userAgent: "Macintosh" });
    const { attachMacImeBridge } = await import("./macImeBridge");

    const writes: string[] = [];
    const textarea = createFakeTextarea();
    attachMacImeBridge(
      { textarea } as unknown as Parameters<typeof attachMacImeBridge>[0],
      (data) => writes.push(data),
    );

    // User types "git" — the browser accumulates it in the textarea.
    for (const next of ["g", "gi", "git"]) {
      textarea.value = next;
      textarea.fire("input", { inputType: "insertText" });
    }
    expect(writes).toEqual(["g", "i", "t"]);

    // xterm clears the textarea on blur without firing `input`.
    textarea.value = "";
    // Refocus resyncs; the next keystroke must forward alone.
    textarea.fire("focus", {});
    textarea.value = "!";
    textarea.fire("input", { inputType: "insertText" });

    expect(writes).toEqual(["g", "i", "t", "!"]);
  });

  it("cancels a lost composition on blur so refocus can resume Telex input", async () => {
    vi.stubGlobal("navigator", { userAgent: "Macintosh" });
    const { attachMacImeBridge } = await import("./macImeBridge");

    const writes: string[] = [];
    const textarea = createFakeTextarea();
    let xtermSawSyntheticEnd = false;
    textarea.addEventListener("compositionend", (event) => {
      if ((event as { isTrusted?: boolean }).isTrusted === false) {
        xtermSawSyntheticEnd = true;
      }
    });
    attachMacImeBridge(
      { textarea } as unknown as Parameters<typeof attachMacImeBridge>[0],
      (data) => writes.push(data),
    );

    textarea.value = "t";
    textarea.fire("compositionstart", { isTrusted: true });
    textarea.value = "te";
    textarea.fire("input", {
      inputType: "insertCompositionText",
      isTrusted: true,
    });

    // xterm clears its textarea during blur, but WebKit can omit compositionend.
    textarea.value = "";
    textarea.fire("blur", {});
    textarea.fire("focus", {});
    textarea.value = "t";
    textarea.fire("input", { inputType: "insertText", isTrusted: true });

    expect(xtermSawSyntheticEnd).toBe(true);
    expect(writes).toEqual(["t"]);
  });

  it("forwards a trusted composition commit unchanged", async () => {
    vi.stubGlobal("navigator", { userAgent: "Macintosh" });
    const { attachMacImeBridge } = await import("./macImeBridge");

    const writes: string[] = [];
    const textarea = createFakeTextarea();
    attachMacImeBridge(
      { textarea } as unknown as Parameters<typeof attachMacImeBridge>[0],
      (data) => writes.push(data),
    );

    textarea.fire("compositionstart", { isTrusted: true });
    textarea.value = "tiếng";
    textarea.fire("compositionend", { isTrusted: true });

    expect(writes).toEqual(["tiếng"]);
  });

  it("cancels a composition when the host window blurs before the textarea does", async () => {
    vi.stubGlobal("navigator", { userAgent: "Macintosh" });
    const { attachMacImeBridge } = await import("./macImeBridge");

    const writes: string[] = [];
    const ownerWindow = createFakeWindow();
    const textarea = createFakeTextarea(ownerWindow);
    attachMacImeBridge(
      { textarea } as unknown as Parameters<typeof attachMacImeBridge>[0],
      (data) => writes.push(data),
    );

    textarea.value = "te";
    textarea.fire("compositionstart", { isTrusted: true });
    ownerWindow.fire("blur");
    textarea.fire("focus", {});
    textarea.value = "t";
    textarea.fire("input", { inputType: "insertText", isTrusted: true });

    expect(writes).toEqual(["t"]);
  });
});
