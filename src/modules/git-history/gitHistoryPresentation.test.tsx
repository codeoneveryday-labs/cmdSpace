import { describe, expect, it } from "vitest";
import {
  authorInitials,
  authorTint,
  basename,
  dirname,
  normalizeError,
  statusTone,
} from "./gitHistoryPresentation";

describe("gitHistoryPresentation", () => {
  it("formats author and path presentation values", () => {
    expect(authorInitials("Ada Lovelace")).toBe("AL");
    expect(authorInitials(" ")).toBe("?");
    expect(authorTint("ada@example.com")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(basename("/repo/src/App.tsx")).toBe("App.tsx");
    expect(dirname("/repo/src/App.tsx")).toBe("/repo/src");
  });

  it("maps status and unknown errors without throwing", () => {
    expect(statusTone("M")).toContain("amber");
    expect(normalizeError({ message: "failed" })).toBe("failed");
    expect(normalizeError(42)).toBe("Unknown error");
  });
});
