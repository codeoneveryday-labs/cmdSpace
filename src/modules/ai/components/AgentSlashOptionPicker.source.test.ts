import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentSlashOptionPicker.tsx", import.meta.url),
  "utf8",
);

describe("AgentSlashOptionPicker contract", () => {
  it("renders selectable slash options with loading and empty states", () => {
    expect(source).toContain("export function AgentSlashOptionPicker");
    expect(source).toContain("Loading options…");
    expect(source).toContain("No options returned by this CLI");
    expect(source).toContain("onSelect(option.id)");
    expect(source).toContain("setOpen(false)");
  });
});
