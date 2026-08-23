import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "ImportSessionSheet.tsx");

describe("ImportSessionSheet", () => {
  it("loads importable sessions over the remote websocket protocol", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("client.listImportableSessions");
    expect(source).toContain('message.type === "importableSessions"');
    expect(source).toContain("client.importSession");
    expect(source).not.toContain("fetch(");
  });

  it("renders a bottom sheet with refresh, filter, and per-session import", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("remote-sheet-backdrop");
    expect(source).toContain('aria-label="Refresh"');
    expect(source).toContain("providerLabel");
    expect(source).toContain("timeAgo");
    expect(source).toContain("disabled={session.active || importing !== null}");
  });
});
