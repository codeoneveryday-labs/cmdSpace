import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
});
