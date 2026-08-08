import { describe, expect, it } from "vitest";
import { createMacTextInputDeduplicator } from "./macImeBridge";

/**
 * Regression test for the macOS IME double-input bug (`lslslslslsls`).
 *
 * WKWebView delivers a printable keystroke (Vietnamese IME Telex, English
 * passthrough) as an `input` event with `inputType: "insertText"` on the
 * xterm textarea — without any `composition*` events. Two capture-phase
 * listeners then both see the same event:
 *
 *  1. xterm's internal `_inputEvent` (registered in the constructor, runs
 *     first) forwards `e.data` to `onData`.
 *  2. the mac IME bridge's `input` handler (registered after xterm) diffs the
 *     textarea value and forwards the same character again.
 *
 * The bridge must forward only what xterm did NOT already forward. Because
 * xterm runs first and preventDefault's only when `cancelEvents` is on (it is
 * not here), the reliable signal is the event target: once xterm has consumed
 * the insertion it calls `preventDefault` via `cancel()` only in some configs —
 * so instead we make the bridge forward exactly the delta xterm would, and
 * drop the write when the character was already delivered by xterm's input
 * path.
 */

describe("macOS IME double-input prevention", () => {
  it("forwards a batched Telex commit once when xterm and the bridge emit it", () => {
    const writes: string[] = [];
    const input = createMacTextInputDeduplicator((data) => writes.push(data));

    input.writeXtermData("lslslsls");
    input.writeBridgeData("lslslsls");

    expect(writes).toEqual(["lslslsls"]);
  });

  it("keeps a plain-text paste when the IME bridge has no matching event", async () => {
    const writes: string[] = [];
    const input = createMacTextInputDeduplicator((data) => writes.push(data));

    input.writeXtermData("git status");
    await Promise.resolve();

    expect(writes).toEqual(["git status"]);
  });
});
