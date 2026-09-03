import { describe, expect, it } from "vitest";
import {
  clampUsagePercent,
  USAGE_BAR_TONE_CLASS,
  USAGE_TEXT_TONE_CLASS,
  usagePercentTone,
} from "./usagePercentTone";

describe("usagePercentTone", () => {
  it("marks 90-100% as critical", () => {
    expect(usagePercentTone(90)).toBe("critical");
    expect(usagePercentTone(99)).toBe("critical");
    expect(usagePercentTone(100)).toBe("critical");
  });

  it("marks 50-89% as warning", () => {
    expect(usagePercentTone(50)).toBe("warning");
    expect(usagePercentTone(75)).toBe("warning");
    expect(usagePercentTone(89)).toBe("warning");
  });

  it("marks below 50% as ok", () => {
    expect(usagePercentTone(0)).toBe("ok");
    expect(usagePercentTone(40)).toBe("ok");
    expect(usagePercentTone(49)).toBe("ok");
  });

  it("clamps out-of-range input", () => {
    expect(clampUsagePercent(120)).toBe(100);
    expect(clampUsagePercent(-5)).toBe(0);
    expect(clampUsagePercent(Number.NaN)).toBe(0);
    expect(clampUsagePercent(42.6)).toBe(43);
  });

  it("maps every tone to bar and text classes", () => {
    for (const tone of ["ok", "warning", "critical"] as const) {
      expect(USAGE_BAR_TONE_CLASS[tone]).toMatch(/^bg-/);
      expect(USAGE_TEXT_TONE_CLASS[tone]).toMatch(/^text-/);
    }
    expect(USAGE_BAR_TONE_CLASS.critical).toContain("red");
    expect(USAGE_BAR_TONE_CLASS.warning).toContain("amber");
    expect(USAGE_BAR_TONE_CLASS.ok).toContain("emerald");
  });
});
