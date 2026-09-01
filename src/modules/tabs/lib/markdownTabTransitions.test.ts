import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import { openMarkdownTabState } from "./markdownTabTransitions";

const tabs = [{ id: 1, kind: "preview", title: "A", url: "https://a.test" }] as Tab[];

describe("markdownTabTransitions", () => {
  it("dedupes an existing markdown path", () => {
    const existing = { id: 2, kind: "markdown", title: "README.md", path: "/repo/README.md" } as Tab;
    let called = false;
    const result = openMarkdownTabState([existing], "/repo/README.md", () => { called = true; return 9; });
    expect(result.targetId).toBe(2);
    expect(called).toBe(false);
  });

  it("creates a new markdown tab when path is absent", () => {
    const result = openMarkdownTabState(tabs, "/repo/README.md", () => 2);
    expect(result.targetId).toBe(2);
    expect(result.tabs[1]).toMatchObject({ kind: "markdown", title: "README.md" });
  });
});
