import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMacCompositionCommitFilter } from "./macImeBridge";

/**
 * Regression test for duplicate Telex batches and trailing spaces. xterm's
 * native CompositionHelper already owns its textarea, composition events, and
 * onData emission. Installing a second textarea writer recreates two PTY input
 * sources and makes event-order deduplication inherently timing-dependent.
 */

describe("macOS IME single-input path", () => {
  it("does not install a second textarea writer beside xterm", () => {
    const here = path.dirname(new URL(import.meta.url).pathname);
    const imeSource = readFileSync(path.join(here, "macImeBridge.ts"), "utf8");

    expect(imeSource).not.toContain("attachMacImeBridge");
    expect(imeSource).not.toContain("createMacTextInputDeduplicator");
    expect(imeSource).not.toContain("stopImmediatePropagation");
  });

  it("forwards one immediate commit and drops xterm's deferred duplicate", () => {
    const scheduledClears: Array<{ callback: () => void; delayMs: number }> = [];
    const filter = createMacCompositionCommitFilter((callback, delayMs) => {
      scheduledClears.push({ callback, delayMs });
    });

    filter.beginKeydownFinalization();

    expect(filter.shouldForward("lslsls")).toBe(true);
    // xterm can finalize synchronously on the Command key before WebKit fires
    // compositionend. Re-entering finalization must preserve the first commit.
    filter.beginCompositionFinalization();
    expect(filter.shouldForward("lslsls")).toBe(false);
    expect(filter.shouldForward(" ")).toBe(true);
    expect(scheduledClears.map(({ delayMs }) => delayMs)).toEqual([1_000, 0]);

    scheduledClears.find(({ delayMs }) => delayMs === 0)?.callback();
    expect(filter.shouldForward("lslsls")).toBe(true);
  });

  it("preserves repeated input outside a composition finalization", () => {
    const filter = createMacCompositionCommitFilter(() => {});

    expect(filter.shouldForward("lslsls")).toBe(true);
    expect(filter.shouldForward("lslsls")).toBe(true);
  });
});
