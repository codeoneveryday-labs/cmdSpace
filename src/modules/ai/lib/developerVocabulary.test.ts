import { describe, expect, it } from "vitest";
import { developerVocabularyFromWorkspace } from "./developerVocabulary";

describe("developerVocabularyFromWorkspace", () => {
  it("derives a bounded technical vocabulary from workspace manifests", () => {
    const vocabulary = developerVocabularyFromWorkspace("/work/terax-ai", [
      {
        name: "package.json",
        content: JSON.stringify({
          name: "cmdspace",
          dependencies: { "@tauri-apps/api": "^2", "xterm": "^5" },
          devDependencies: { vitest: "^2" },
          scripts: { desktop: "tauri dev" },
        }),
      },
      {
        name: "Cargo.toml",
        content: '[package]\nname = "cmdspace-core"\n[dependencies]\nportable-pty = "0.9"\nrusqlite = "0.32"',
      },
    ]);

    expect(vocabulary).toContain("terax-ai");
    expect(vocabulary).toContain("cmdspace");
    expect(vocabulary).toContain("@tauri-apps/api");
    expect(vocabulary).toContain("portable-pty");
    expect(vocabulary.length).toBeLessThanOrEqual(900);
  });

  it("ignores malformed manifests and never exposes their content verbatim", () => {
    const vocabulary = developerVocabularyFromWorkspace("/work/private", [
      { name: "package.json", content: "not json TOKEN_SHOULD_NOT_LEAK" },
    ]);

    expect(vocabulary).toContain("private");
    expect(vocabulary).not.toContain("TOKEN_SHOULD_NOT_LEAK");
  });
});
