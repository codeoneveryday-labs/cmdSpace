import { describe, expect, it } from "vitest";
import { fileIconUrl, folderIconUrl } from "./iconResolver";

describe("VS Code file icon resolver", () => {
  it.each([
    ["lib.rs", "rust"],
    ["index.ts", "typescript"],
    ["App.tsx", "react_ts"],
    ["main.py", "python"],
    ["server.go", "go"],
    ["Dockerfile", "docker"],
    [".dockerignore", "docker"],
    ["README.md", "readme"],
    ["package.json", "nodejs"],
    ["docker-compose.yml", "docker"],
    ["Cargo.toml", "rust"],
    ["pnpm-lock.yaml", "pnpm"],
    ["vite.config.ts", "vite"],
    ["tailwind.config.ts", "tailwindcss"],
  ])("renders %s with the %s VS Code SVG", (name, icon) => {
    expect(fileIconUrl(name)).toContain(`/${icon}.svg`);
  });

  it.each([
    ["src", "folder-src"],
    ["components", "folder-components"],
    [".github", "folder-github"],
    ["node_modules", "folder-node"],
    [".vscode", "folder-vscode"],
    ["tests", "folder-test"],
  ])("renders %s with the %s VS Code folder SVG", (name, icon) => {
    expect(folderIconUrl(name, false)).toContain(`/${icon}.svg`);
    expect(folderIconUrl(name, true)).toContain(`/${icon}-open.svg`);
  });
});
