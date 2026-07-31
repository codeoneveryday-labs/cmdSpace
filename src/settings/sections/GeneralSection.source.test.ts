import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const generalSectionPath = path.join(here, "GeneralSection.tsx");
const remoteAccessPath = path.join(here, "../../modules/settings/remoteAccess.ts");

describe("GeneralSection terminal settings", () => {
  it("exposes copy-on-select as an explicit terminal preference", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain("terminalCopyOnSelection");
    expect(source).toContain("setTerminalCopyOnSelection");
    expect(source).toContain("Copy selected text");
    expect(source).toContain(
      "onCheckedChange={(v) => void setTerminalCopyOnSelection(v)}",
    );
  });

  it("lets the user opt into the floating voice agent", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain("floatingVoiceAgentEnabled");
    expect(source).toContain("setFloatingVoiceAgentEnabled");
    expect(source).toContain("Floating Voice Agent");
    expect(source).toContain(
      "onCheckedChange={(v) => void setFloatingVoiceAgentEnabled(v)}",
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
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("export function remoteAccessStart()");
    expect(source).toContain("remoteAccessStart()");
    expect(source).toContain("authenticated LAN UI and public tunnel");
    expect(source).toContain("Enable remote access to generate a QR and public link.");
    expect(source).not.toContain("Local app source");
    expect(source).not.toContain("frontend dev ports");
    expect(source).not.toContain("setRemoteAccessTargetPort");
    expect(source).not.toContain('type="number"');
  });

  it("offers a direct remote URL opener", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain('import { openUrl } from "@tauri-apps/plugin-opener"');
    expect(source).toContain("Open");
    expect(source).toContain("openUrl(remotePublicUrl)");
  });

  it("shows a bootstrap QR without exposing pairing-code controls", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("bootstrapSecret?: string");
    expect(source).toContain("remoteBootstrapSecret");
    expect(source).toContain("remoteQrUrl");
    expect(source).not.toContain("Pairing code");
    expect(source).not.toContain("PAIRING_CODE_VISIBLE_MS");
    expect(remoteSource).not.toContain("remoteAccessNewPairingCode");
    expect(source).not.toContain("Generate new pairing code");
  });

  it("shows localhost.run lifecycle and preserves the LAN fallback URL", () => {
    const source = readFileSync(generalSectionPath, "utf8");
    const remoteSource = readFileSync(remoteAccessPath, "utf8");

    expect(remoteSource).toContain("tunnelState: RemoteTunnelState");
    expect(remoteSource).toContain("lanUrl: string");
    expect(remoteSource).toContain("publicUrl?: string");
    expect(source).toContain("Public tunnel");
    expect(source).toContain("LAN fallback");
    expect(source).toContain("remoteTunnelState");
    expect(source).toContain("remoteTunnelError");
  });

  it("renders an Android-safe setup path with the first-setup bootstrap secret", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain('import QRCode from "react-qr-code"');
    expect(source).toContain("Scan to connect");
    expect(source).toContain("value={remoteQrUrl}");
    expect(source).toContain('url.pathname = `/setup/${encodeURIComponent(bootstrapSecret)}`');
    expect(source).not.toContain("value={remoteBootstrapSecret}");
  });

  it("lets the Mac owner reset a forgotten remote password", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain("Reset remote password");
    expect(source).toContain("remoteAccessResetPassword()");
    expect(source).toContain("<AlertDialog open={remoteResetDialogOpen}");
    expect(source).toContain("setRemoteResetDialogOpen(true)");
    expect(source).toContain("Password reset. Scan the new QR");
    expect(source).toContain("sign out every connected device");
    expect(source).not.toContain("Signs out every connected device and creates a new setup QR.");
    expect(source).not.toContain("Remote web UI is running from cmdSpace. No separate app port is");
    expect(source).not.toContain("window.confirm(");
  });

  it("uses one compact connection card instead of duplicating public-link copy", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain("Remote access");
    expect(source).toContain("Scan to connect");
    expect(source).not.toContain("How to connect");
    expect(source).not.toContain("Open the remote URL below from another device.");
  });

  it("confirms copied remote links and keeps the reset action visually separate without a divider", () => {
    const source = readFileSync(generalSectionPath, "utf8");

    expect(source).toContain('setCopiedRemoteLink] = useState<');
    expect(source).toContain('"public" | "lan" | null');
    expect(source).toContain("setCopiedRemoteLink(kind)");
    expect(source).toContain('copiedRemoteLink === "public"');
    expect(source).toContain('copiedRemoteLink === "lan"');
    expect(source).toContain("CheckmarkCircle01Icon");
    expect(source).toContain('title={copiedRemoteLink === "public" ? "Copied" : "Copy public link"}');
    expect(source).toContain('title={copiedRemoteLink === "lan" ? "Copied" : "Copy LAN fallback link"}');
    expect(source).not.toContain(
      'className="mt-3 flex justify-end border-t border-border/45 pt-3"',
    );
  });
});
