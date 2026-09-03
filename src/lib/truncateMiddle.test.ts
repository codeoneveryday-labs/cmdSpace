import { describe, expect, it } from "vitest";
import { truncateMiddle } from "./truncateMiddle";

describe("truncateMiddle", () => {
  it("returns empty string for null, undefined, or empty input", () => {
    expect(truncateMiddle(null)).toBe("");
    expect(truncateMiddle(undefined)).toBe("");
    expect(truncateMiddle("")).toBe("");
  });

  it("does not truncate strings shorter than or equal to maxLength", () => {
    expect(truncateMiddle("Workspace", 26)).toBe("Workspace");
    expect(truncateMiddle("index.ts", 26)).toBe("index.ts");
    expect(truncateMiddle("exactly-26-characters-here", 26)).toBe("exactly-26-characters-here");
  });

  it("middle-truncates long workspace names without extensions (start...end)", () => {
    const longName = "Super long nameaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const truncated = truncateMiddle(longName, 26);
    expect(truncated.length).toBeLessThanOrEqual(26);
    expect(truncated).toContain("...");
    expect(truncated.startsWith("Super long")).toBe(true);
    expect(truncated.endsWith("aaaa")).toBe(true);
  });

  it("preserves file extensions when middle-truncating (start...end.ext)", () => {
    const longFile = "SuperLongComponentControllerWithExtraDetails.tsx";
    const truncated = truncateMiddle(longFile, 26);
    expect(truncated.length).toBeLessThanOrEqual(26);
    expect(truncated.endsWith(".tsx")).toBe(true);
    expect(truncated.startsWith("SuperLong")).toBe(true);
    expect(truncated).toContain("...");
  });

  it("preserves compound file extensions (.tar.gz, .d.ts, .test.tsx)", () => {
    const tarGz = "database-backup-production-2026.tar.gz";
    const truncatedTar = truncateMiddle(tarGz, 28);
    expect(truncatedTar.length).toBeLessThanOrEqual(28);
    expect(truncatedTar.endsWith(".tar.gz")).toBe(true);
    expect(truncatedTar.startsWith("database")).toBe(true);

    const testFile = "useTerminalWorkspaceActions.test.tsx";
    const truncatedTest = truncateMiddle(testFile, 28);
    expect(truncatedTest.length).toBeLessThanOrEqual(28);
    expect(truncatedTest.endsWith(".test.tsx")).toBe(true);
  });

  it("handles hidden dotfiles without extensions properly", () => {
    expect(truncateMiddle(".gitignore", 20)).toBe(".gitignore");
    const longDotfile = ".very-long-hidden-configuration-file";
    const truncated = truncateMiddle(longDotfile, 20);
    expect(truncated.length).toBeLessThanOrEqual(20);
    expect(truncated.startsWith(".very")).toBe(true);
  });

  it("supports custom ellipsis and prefixRatio", () => {
    const text = "SuperLongWorkspaceNameProject";
    const truncated = truncateMiddle(text, 20, { ellipsis: "…", prefixRatio: 0.5 });
    expect(truncated.length).toBeLessThanOrEqual(20);
    expect(truncated).toContain("…");
  });
});
