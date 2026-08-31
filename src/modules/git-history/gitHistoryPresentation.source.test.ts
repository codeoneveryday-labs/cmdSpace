import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./gitHistoryPresentation.tsx", import.meta.url), "utf8");

describe("gitHistoryPresentation contract", () => {
  it("keeps formatting helpers independent from loading and IPC", () => {
    expect(source).toContain("authorInitials");
    expect(source).toContain("statusTone");
    expect(source).toContain("highlight");
    expect(source).not.toContain("native.");
    expect(source).not.toContain("useEffect");
  });
});
