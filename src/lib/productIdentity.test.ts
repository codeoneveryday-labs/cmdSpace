import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PRODUCT_IDENTITY } from "./productIdentity";

const root = path.resolve(__dirname, "../..");

describe("product identity", () => {
  it("keeps the Tauri updater manifest aligned with the frontend repository identity", () => {
    const config = JSON.parse(
      readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
    ) as { plugins: { updater: { endpoints: string[] } } };

    expect(PRODUCT_IDENTITY.github.repoUrl).toBe(
      "https://github.com/codeoneveryday-labs/cmdSpace",
    );
    expect(PRODUCT_IDENTITY.github.latestReleaseApiUrl).toBe(
      "https://api.github.com/repos/codeoneveryday-labs/cmdSpace/releases/latest",
    );
    expect(config.plugins.updater.endpoints).toContain(
      PRODUCT_IDENTITY.github.updaterManifestUrl,
    );
  });
});
