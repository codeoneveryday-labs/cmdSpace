import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const breadcrumbPath = path.join(here, "CwdBreadcrumb.tsx");

describe("CwdBreadcrumb", () => {
  it("offers parent directory navigation from the directory dropdown", () => {
    const source = readFileSync(breadcrumbPath, "utf8");

    expect(source).toContain("const parentPath = dirname(path);");
    expect(source).toContain('import { VirtualizedDropdownList } from "@/components/ui/virtualized-dropdown-list";');
    expect(source).toContain("<VirtualizedDropdownList");
    expect(source).toContain("items={children}");
    expect(source).toContain(".. (Parent Directory)");
    expect(source).toContain("onCd(parentPath)");
    expect(source).toContain("max-h-64 min-w-56 overflow-y-scroll p-0");
    expect(source).toContain('className="rounded-none"');
    expect(source).not.toContain("Search branches...");
    expect(source).not.toContain("git switch");
  });
});
