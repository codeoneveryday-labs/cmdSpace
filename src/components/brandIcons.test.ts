import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandIcon } from "./BrandIcon";
import {
  BRAND_ICON_ASSETS,
  BRAND_ICON_SOURCE_URLS,
  getAgentBrandIcon,
  getProviderBrandIcon,
} from "./brandIcons";

describe("brand icon catalog", () => {
  it("maps supported AI providers to Paseo artwork", () => {
    expect(getProviderBrandIcon("openai")).toBe("codex");
    expect(getProviderBrandIcon("anthropic")).toBe("claude");
    expect(getProviderBrandIcon("google")).toBe("gemini");
    expect(getProviderBrandIcon("xai")).toBe("grok");
    expect(getProviderBrandIcon("mistral")).toBe("mistral");
    expect(getProviderBrandIcon("ollama")).toBeNull();
  });

  it("maps supported coding agents to the same Paseo artwork", () => {
    expect(getAgentBrandIcon("claude")).toBe("claude");
    expect(getAgentBrandIcon("codex")).toBe("codex");
    expect(getAgentBrandIcon("gemini")).toBe("gemini");
    expect(getAgentBrandIcon("copilot")).toBe("copilot");
    expect(getAgentBrandIcon("opencode")).toBe("opencode");
    expect(getAgentBrandIcon("cursor")).toBe("cursor");
    expect(getAgentBrandIcon("pi")).toBe("pi");
    expect(getAgentBrandIcon("amp")).toBe("amp");
    expect(getAgentBrandIcon("cline")).toBe("cline");
    expect(getAgentBrandIcon("goose")).toBe("goose");
    expect(getAgentBrandIcon("qwen")).toBe("qwen");
    expect(getAgentBrandIcon("kimi")).toBe("kimi");
    expect(getAgentBrandIcon("grok")).toBe("grok");
    expect(getAgentBrandIcon("cmd")).toBe("cmd");
    expect(getAgentBrandIcon("aider")).toBeNull();
  });

  it("renders SVG artwork inline instead of relying on WebKit URL masks", () => {
    const markup = renderToStaticMarkup(
      createElement(BrandIcon, { name: "codex", size: 14 }),
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain("<path");
    expect(markup).not.toContain("mask-image");
  });

  it("uses Paseo's exact builtin provider artwork", () => {
    expect(BRAND_ICON_ASSETS.claude).toContain('viewBox="0 0 24 24"');
    expect(BRAND_ICON_ASSETS.claude).toContain('d="M4.709 15.955');
    expect(BRAND_ICON_ASSETS.codex).toContain('d="M21.55 10.004');
    expect(BRAND_ICON_ASSETS.copilot).toContain('viewBox="0 0 512 416"');
    expect(BRAND_ICON_ASSETS.copilot).toContain('d="M181.33 266.143');
    expect(BRAND_ICON_ASSETS.opencode).toContain('viewBox="96 64 288 384"');
    expect(BRAND_ICON_ASSETS.pi).toContain('viewBox="100 100 600 600"');
    expect(BRAND_ICON_ASSETS.pi).toContain('d="M165.29 165.29');
  });

  it("uses Command Code's official upstream symbol", () => {
    expect(BRAND_ICON_ASSETS.cmd).toContain("<title>Command Code</title>");
    expect(BRAND_ICON_SOURCE_URLS.cmd).toBe(
      "https://raw.githubusercontent.com/CommandCodeAI/command-code/main/.github/commandcode/symbols/commandcode.svg",
    );
  });
});
