import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sectionPath = path.join(here, "ModelsSection.tsx");
const catalogPath = path.join(here, "providerCatalog.ts");

describe("Models settings provider catalog", () => {
  it("uses an inline provider catalog instead of an add-provider popup", () => {
    const section = readFileSync(sectionPath, "utf8");
    const catalog = readFileSync(catalogPath, "utf8");

    expect(section).toContain("Configured providers");
    expect(section).toContain("Search providers");
    expect(section).toContain("ProviderCatalogRow");
    expect(section).toContain("filterProviderCatalog");
    expect(catalog).toContain("provider.id");
    expect(catalog).toContain("provider.description");
    expect(catalog).toContain("provider.modelLabels");
    expect(section).not.toContain("function AddProviderMenu");
    expect(section).not.toContain("ProviderMenuItem");
    expect(section).not.toContain("DropdownMenuLabel");
  });
});
