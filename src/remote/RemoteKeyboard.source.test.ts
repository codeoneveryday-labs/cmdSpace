import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("RemoteKeyboard mobile events", () => {
  it("uses clsh-style touch surfaces plus a mouse fallback without button click duplication", () => {
    const source = readFileSync(path.join(here, "RemoteKeyboard.tsx"), "utf8");

    expect(source).toContain("onTouchStart={triggerTouch}");
    expect(source).toContain("onTouchEnd={releaseTouch}");
    expect(source).toContain("onTouchCancel={releaseTouch}");
    expect(source).toContain("onMouseDown={triggerMouse}");
    expect(source).toContain("<button");
    expect(source).toContain("onKeyDown={triggerKeyboard}");
    expect(source).toContain("touchActiveRef");
    expect(source).not.toContain("onPointerDown");
    expect(source).not.toContain("onClick");
  });
});
