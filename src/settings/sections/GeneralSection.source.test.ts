import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const generalSectionPath = path.join(here, "GeneralSection.tsx");
const remoteHubPath = path.join(here, "RemoteAccessHub.tsx");
const remoteAccessPath = path.join(here, "../../modules/settings/remoteAccess.ts");
const settingsStorePath = path.join(here, "../../modules/settings/store.ts");
const pairingHookPath = path.join(here, "useRemoteDevicePairing.ts");
const tunnelHookPath = path.join(here, "useRemoteTunnelSettings.ts");
const terminalSettingsPath = path.join(here, "TerminalPreferencesSection.tsx");

describe("GeneralSection terminal settings", () => {
  it("delegates Remote presentation to the compact access hub", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");

    expect(source).toContain("<RemoteAccessHub");
    expect(source).not.toContain("Scan to connect");
    expect(source).not.toContain("Native iPhone / iPad");
    expect(source).not.toContain('title="Allow remote access"');
    expect(hub).toContain("Show QR");
    expect(hub).toContain("Paired devices");
    expect(hub).toContain("Advanced");
  });

  it("offers the supported 8 px terminal text size", () => {
    const store = readFileSync(settingsStorePath, "utf8");

    expect(store).toContain("export const TERMINAL_FONT_SIZES = [\n  8, 10,");
  });

  it("persists a shell choice for newly created terminals", () => {
    const source = `${readFileSync(generalSectionPath, "utf8")}\n${readFileSync(terminalSettingsPath, "utf8")}`;
    const store = readFileSync(settingsStorePath, "utf8");

    expect(source).toContain('title="Default shell"');
    expect(source).toContain("setTerminalShell");
    expect(source).toContain('invoke<TerminalShell[]>("pty_available_shells")');
    expect(source).toContain('" (not installed)"');
    expect(source).toContain("Running terminals keep their current shell.");
    expect(store).toContain('export type TerminalShell = "system" | "zsh" | "bash" | "fish"');
    expect(store).toContain('const KEY_TERMINAL_SHELL = "terminalShell"');
  });

  it("lets users persist exact folder names excluded from Explorer", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const store = readFileSync(settingsStorePath, "utf8");

    expect(source).toContain("explorerExcludedFolderNames");
    expect(source).toContain("setExplorerExcludedFolderNames");
    expect(source).toContain('title="Hidden folders"');
    expect(source).toContain('aria-label="Hidden folders"');
    expect(source).toContain('placeholder=".git, node_modules, dist, target"');
    expect(source).toContain("onBlur={saveExcludedFolderNames}");
    expect(source).toContain('event.key === "Enter"');
    expect(store).toContain(
      'const KEY_EXPLORER_EXCLUDED_FOLDER_NAMES = "explorerExcludedFolderNames"',
    );
    expect(store).toContain("DEFAULT_EXCLUDED_FOLDER_NAMES");
  });

  it("exposes copy-on-select as an explicit terminal preference", () => {
    const source = `${readFileSync(generalSectionPath, "utf8")}\n${readFileSync(terminalSettingsPath, "utf8")}`;

    expect(source).toContain("terminalCopyOnSelection");
    expect(source).toContain("setTerminalCopyOnSelection");
    expect(source).toContain("Copy selected text");
    expect(source).toContain(
      "onCheckedChange={(value) => void setTerminalCopyOnSelection(value)}",
    );
  });

  it("lets the user opt into Space", () => {
    const source = `${readFileSync(generalSectionPath, "utf8")}\n${readFileSync(terminalSettingsPath, "utf8")}`;

    expect(source).toContain("floatingVoiceAgentEnabled");
    expect(source).toContain("setFloatingVoiceAgentEnabled");
    expect(source).toContain('title="Space"');
    expect(source).toContain(
      "onCheckedChange={(value) => void setFloatingVoiceAgentEnabled(value)}",
    );
  });

  it("keeps voice language fully automatic without a manual locale setting", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const preferences = readFileSync(
      path.join(here, "../../modules/settings/store.ts"),
      "utf8",
    );

    expect(source).not.toContain("Voice language");
    expect(source).not.toContain("setVoiceLanguage");
    expect(source).not.toContain("speechLanguageOptions");
    expect(source).not.toContain('speech_supported_locales');
    expect(preferences).not.toContain("voiceLanguage");
    expect(preferences).not.toContain("VoiceLanguage");
  });

  it("keeps remote access commands visible to Tauri command pruning", () => {
    const source = readFileSync(remoteAccessPath, "utf8");

    expect(source).toContain('invoke<RemoteAccessStatus>("remote_access_status"');
    expect(source).toContain('invoke<RemoteAccessStatus>("remote_access_start"');
    expect(source).toContain('invoke<RemoteAccessStatus>("remote_access_stop"');
    expect(source).toContain(
      'invoke<RemoteAccessStatus>("remote_access_reset_password"',
    );
  });

  it("uses cmdSpace's self-hosted remote UI instead of a project port", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const tunnel = readFileSync(tunnelHookPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("export function remoteAccessStart()");
    expect(`${source}\n${tunnel}`).toContain("remoteAccessStart()");
    expect(hub).toContain("Public connection");
    expect(hub).toContain("Turn on Remote access");
    expect(source).not.toContain("Local app source");
    expect(source).not.toContain("frontend dev ports");
    expect(source).not.toContain("setRemoteAccessTargetPort");
    expect(source).not.toContain('type="number"');
  });

  it("offers a direct remote URL opener", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");

    expect(source).toContain('import { openUrl } from "@tauri-apps/plugin-opener"');
    expect(hub).toContain("Open");
    expect(source).toContain("openUrl(remotePublicUrl)");
  });

  it("shows a bootstrap QR without exposing pairing-code controls", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const tunnel = readFileSync(tunnelHookPath, "utf8");
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("bootstrapSecret?: string");
    expect(`${source}\n${tunnel}`).toContain("bootstrapSecret");
    expect(source).toContain("remoteQrUrl");
    expect(source).not.toContain("Pairing code");
    expect(source).not.toContain("PAIRING_CODE_VISIBLE_MS");
    expect(remoteSource).not.toContain("remoteAccessNewPairingCode");
    expect(source).not.toContain("Generate new pairing code");
  });

  it("shows localhost.run lifecycle and preserves the LAN fallback URL", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("tunnelState: RemoteTunnelState");
    expect(remoteSource).toContain("lanUrl: string");
    expect(remoteSource).toContain("publicUrl?: string");
    expect(hub).toContain("Public connection");
    expect(hub).toContain("LAN fallback");
    expect(source).toContain("remoteTunnelState");
    expect(source).toContain("remoteTunnelError");
  });

  it("clears a native pairing QR when the public tunnel hostname changes", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const pairing = readFileSync(pairingHookPath, "utf8");

    expect(`${source}\n${pairing}`).toContain("setPairing(null);");
    expect(pairing).toContain("[publicUrl]");
  });

  it("renders an Android-safe setup path with the first-setup bootstrap secret", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const tunnel = readFileSync(tunnelHookPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");

    expect(hub).toContain('import QRCode from "react-qr-code"');
    expect(hub).toContain("Scan to connect");
    expect(hub).toContain("value={setupQrUrl}");
    expect(`${source}\n${tunnel}`).toContain('url.pathname = `/setup/${encodeURIComponent(bootstrapSecret)}`');
    expect(source).not.toContain("value={remoteBootstrapSecret}");
  });

  it("lets the Mac owner reset a forgotten remote password", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const tunnel = readFileSync(tunnelHookPath, "utf8");
    const remoteSource = `${source}\n${tunnel}`;

    expect(source).toContain("Reset remote password");
    expect(`${source}\n${tunnel}`).toContain("remoteAccessResetPassword()");
    expect(source).toContain("<AlertDialog open={remoteResetDialogOpen}");
    expect(source).toContain("setRemoteResetDialogOpen(true)");
    expect(remoteSource).toContain("Password reset. Scan the new QR");
    expect(source).toContain("sign out every connected device");
    expect(source).not.toContain("Signs out every connected device and creates a new setup QR.");
    expect(source).not.toContain("Remote web UI is running from cmdSpace. No separate app port is");
    expect(source).not.toContain("window.confirm(");
  });

  it("uses one compact connection card instead of duplicating public-link copy", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");

    expect(source).toContain("RemoteAccessHub");
    expect(hub).toContain("Show QR");
    expect(source).not.toContain("How to connect");
    expect(source).not.toContain("Open the remote URL below from another device.");
  });

  it("confirms copied remote links and keeps the reset action visually separate without a divider", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const tunnel = readFileSync(tunnelHookPath, "utf8");
    const hub = readFileSync(remoteHubPath, "utf8");

    expect(tunnel).toContain('setCopiedLink] = useState<');
    expect(tunnel).toContain('"public" | "lan" | "device" | null');
    expect(tunnel).toContain("setCopiedLink(kind)");
    expect(hub).toContain('copiedLink === "public"');
    expect(hub).toContain('copiedLink === "lan"');
    expect(hub).toContain("CheckmarkCircle01Icon");
    expect(hub).toContain('title={copiedLink === "public" ? "Copied" : "Copy public link"}');
    expect(tunnel).toContain('"public" | "lan" | "device" | null');
    expect(hub).toContain("Copy pairing link");
    expect(source).toContain("pairingUrl={nativeDevicePairingUrl}");
    expect(hub).toContain('copiedLink === "device"');
    expect(source).not.toContain(
      'className="mt-3 flex justify-end border-t border-border/45 pt-3"',
    );
  });
});
