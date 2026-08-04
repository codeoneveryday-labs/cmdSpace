import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("updater release configuration", () => {
  it("builds signed updater artifacts and provides their signing key to releases", () => {
    const config = JSON.parse(
      readFileSync(path.join(here, "tauri.conf.json"), "utf8"),
    ) as {
      version: string;
      bundle: { createUpdaterArtifacts: boolean };
      plugins: { updater: { endpoints: string[]; pubkey: string } };
    };
    const releaseWorkflow = readFileSync(
      path.join(here, "../.github/workflows/release.yml"),
      "utf8",
    );
    const packageManifest = JSON.parse(
      readFileSync(path.join(here, "../package.json"), "utf8"),
    ) as { version: string };
    const cargoManifest = readFileSync(path.join(here, "Cargo.toml"), "utf8");
    const cargoLock = readFileSync(path.join(here, "Cargo.lock"), "utf8");

    expect(packageManifest.version).toBe(config.version);
    expect(cargoManifest).toContain(`version = "${config.version}"`);
    expect(cargoLock).toContain(
      `name = "cmdspace"\nversion = "${config.version}"`,
    );
    expect(config.bundle.createUpdaterArtifacts).toBe(true);
    expect(config.plugins.updater.endpoints).toContain(
      "https://github.com/codeoneveryday-labs/cmdSpace/releases/latest/download/latest.json",
    );
    expect(config.plugins.updater.pubkey).toBe(
      "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDVENzAwOEIyODE3OEMxNzEKUldSeHdYaUJzZ2h3WFpBbjRlVG5SMy85RlBwZVA4Tm4wSWtYTURrMWZaY3A2MXFucFppK09zU0QK",
    );
    expect(releaseWorkflow).toContain(
      "TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}",
    );
    expect(releaseWorkflow).toContain(
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
    );
  });
});

describe("main webview configuration", () => {
  it("keeps native file drag and drop enabled", () => {
    const config = JSON.parse(
      readFileSync(path.join(here, "tauri.conf.json"), "utf8"),
    ) as { app: { windows: Array<{ dragDropEnabled?: boolean }> } };

    expect(config.app.windows[0].dragDropEnabled).toBe(true);
  });
});

describe("macOS microphone signing", () => {
  it("ships the hardened-runtime audio input entitlement", () => {
    const config = JSON.parse(
      readFileSync(path.join(here, "tauri.conf.json"), "utf8"),
    ) as { bundle: { macOS: { entitlements?: string } } };
    const entitlementsPath = path.join(here, "Entitlements.plist");

    expect(config.bundle.macOS.entitlements).toBe("./Entitlements.plist");
    expect(readFileSync(entitlementsPath, "utf8")).toContain(
      "com.apple.security.device.audio-input",
    );
  });
});
