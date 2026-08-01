import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const switchPath = path.join(here, "switch.tsx");

describe("Switch styling", () => {
  it("uses Radix data-state attributes for checked and unchecked states", () => {
    const source = readFileSync(switchPath, "utf8");

    expect(source).toContain("data-[state=checked]:bg-primary");
    expect(source).toContain("data-[state=unchecked]:bg-input/90");
    expect(source).toContain("data-[state=checked]:translate-x");
    expect(source).not.toContain("data-checked:");
    expect(source).not.toContain("data-unchecked:");
  });
});
