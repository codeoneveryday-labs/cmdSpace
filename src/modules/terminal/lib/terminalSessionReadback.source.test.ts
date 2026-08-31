import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionReadback.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionReadback contract", () => {
  it("centralizes live-slot and snapshot buffer readback", () => {
    expect(source).toContain("readTerminalBuffer");
    expect(source).toContain("readTerminalSelection");
    expect(source).toContain("tailTerminalLines");
    expect(source).toContain("tailTerminalSnapshot");
    expect(source).toContain("readTerminalSelection");
  });
});
