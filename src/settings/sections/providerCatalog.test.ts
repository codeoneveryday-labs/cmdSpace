import { describe, expect, it } from "vitest";
import {
  filterProviderCatalog,
  type ProviderCatalogSearchItem,
} from "./providerCatalog";

const providers: ProviderCatalogSearchItem[] = [
  {
    id: "ollama",
    label: "Ollama",
    description: "Local models via an OpenAI-compatible API.",
    modelLabels: ["Qwen 2.5 Coder", "qwen2.5-coder:7b"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Cloud model provider.",
    modelLabels: ["Nemotron Super 49B"],
  },
];

describe("filterProviderCatalog", () => {
  it.each([
    ["ollama", "ollama"],
    ["local", "ollama"],
    ["qwen", "ollama"],
    ["nemotron", "openrouter"],
  ])("matches %s across provider metadata", (query, expectedId) => {
    expect(filterProviderCatalog(providers, query).map(({ id }) => id)).toEqual([
      expectedId,
    ]);
  });

  it("returns every provider for an empty query", () => {
    expect(filterProviderCatalog(providers, "  ")).toEqual(providers);
  });
});
