import { describe, expect, it } from "vitest";
import {
  formatResetDateTime,
  formatResetWeekday,
  formatUsageWindow,
} from "./usageResetTime";

describe("formatUsageWindow", () => {
  it("renders whole days as 7d instead of 168h", () => {
    expect(formatUsageWindow(10080)).toBe("7d");
    expect(formatUsageWindow(1440)).toBe("1d");
  });

  it("renders whole hours and bare minutes", () => {
    expect(formatUsageWindow(300)).toBe("5h");
    expect(formatUsageWindow(60)).toBe("1h");
    expect(formatUsageWindow(45)).toBe("45m");
  });
});

describe("formatResetDateTime", () => {
  it("returns empty for missing or invalid timestamps", () => {
    expect(formatResetDateTime(undefined)).toBe("");
    expect(formatResetDateTime(0)).toBe("");
    expect(formatResetDateTime(Number.NaN)).toBe("");
  });

  it("renders day, short month and time", () => {
    const out = formatResetDateTime(1788245100);
    expect(out).toMatch(/^\d{1,2} \w{3}, \d{2}:\d{2}$/);
  });
});

describe("formatResetWeekday", () => {
  it("returns empty for missing or invalid timestamps", () => {
    expect(formatResetWeekday(undefined)).toBe("");
    expect(formatResetWeekday(0)).toBe("");
  });

  it("renders a short weekday", () => {
    expect(formatResetWeekday(1788245100)).toMatch(/^[A-Z][a-z]{2}$/);
  });
});
