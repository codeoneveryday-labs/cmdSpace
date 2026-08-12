import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_SLIDER_STEP } from "@/lib/zoomConstants";
import { parseExcludedFolderNames } from "@/modules/explorer/lib/excludedFolders";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  remoteAccessResetPassword,
  remoteAccessStart,
  remoteAccessStatus,
  remoteAccessStop,
  remoteDeviceList,
  remoteDevicePairingStart,
  remoteDeviceRevoke,
} from "@/modules/settings/remoteAccess";
import type {
  RemoteDevicePairingStatus,
  RemotePairedDeviceStatus,
  RemoteTunnelState,
} from "@/modules/settings/remoteAccess";
import type { ThemePref } from "@/modules/settings/store";
import {
  TERMINAL_FONT_SIZES,
  TERMINAL_SCROLLBACK_PRESETS,
  setAutostart,
  setExplorerExcludedFolderNames,
  setFloatingVoiceAgentEnabled,
  setRemoteAccessEnabled,
  setRestoreWindowState,
  setShowHidden,
  setTerminalCopyOnSelection,
  setTerminalFontFamily,
  setTerminalLetterSpacing,
  setTerminalFontSize,
  setTerminalScrollback,
  setTerminalWebglEnabled,
  setVimMode,
  setZoomLevel,
} from "@/modules/settings/store";
import { useTheme } from "@/modules/theme";
import {
  CheckmarkCircle01Icon,
  ComputerIcon,
  Copy01Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";

const APPEARANCE: {
  id: ThemePref;
  label: string;
  icon: typeof ComputerIcon;
}[] = [
  { id: "system", label: "System", icon: ComputerIcon },
  { id: "light", label: "Light", icon: Sun03Icon },
  { id: "dark", label: "Dark", icon: Moon02Icon },
];

const LETTER_SPACINGS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
const REMOTE_TUNNEL_LABELS: Record<RemoteTunnelState, string> = {
  starting: "Connecting",
  ready: "Public",
  degraded: "Reconnecting",
  error: "LAN only",
  stopped: "Off",
};

function formatRemoteError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("command")) {
    return "Remote access backend is not loaded yet. Restart the app once, then try again.";
  }
  return error;
}

function remoteSetupUrl(publicUrl: string, bootstrapSecret: string): string {
  if (!publicUrl || !bootstrapSecret) return publicUrl;
  const url = new URL(publicUrl);
  url.pathname = `/setup/${encodeURIComponent(bootstrapSecret)}`;
  return url.toString();
}

export function GeneralSection() {
  const { mode, setMode } = useTheme();

  const autostart = usePreferencesStore((s) => s.autostart);
  const remoteAccessEnabled = usePreferencesStore(
    (s) => s.remoteAccessEnabled,
  );
  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const vimMode = usePreferencesStore((s) => s.vimMode);
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const explorerExcludedFolderNames = usePreferencesStore(
    (s) => s.explorerExcludedFolderNames,
  );
  const terminalWebglEnabled = usePreferencesStore(
    (s) => s.terminalWebglEnabled,
  );
  const terminalCopyOnSelection = usePreferencesStore(
    (s) => s.terminalCopyOnSelection,
  );
  const floatingVoiceAgentEnabled = usePreferencesStore(
    (s) => s.floatingVoiceAgentEnabled,
  );
  const terminalFontFamily = usePreferencesStore((s) => s.terminalFontFamily);
  const terminalLetterSpacing = usePreferencesStore(
    (s) => s.terminalLetterSpacing,
  );
  const terminalFontSize = usePreferencesStore((s) => s.terminalFontSize);
  const terminalScrollback = usePreferencesStore((s) => s.terminalScrollback);
  const zoomLevel = usePreferencesStore((s) => s.zoomLevel);
  const [excludedFolderNamesDraft, setExcludedFolderNamesDraft] = useState(
    explorerExcludedFolderNames.join(", "),
  );
  const [remoteEnabledDraft, setRemoteEnabledDraft] =
    useState(remoteAccessEnabled);
  const [remoteLanUrl, setRemoteLanUrl] = useState("");
  const [remotePublicUrl, setRemotePublicUrl] = useState("");
  const [remoteTunnelState, setRemoteTunnelState] =
    useState<RemoteTunnelState>("stopped");
  const [remoteTunnelError, setRemoteTunnelError] = useState("");
  const [remoteBootstrapSecret, setRemoteBootstrapSecret] = useState("");
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteResetDialogOpen, setRemoteResetDialogOpen] = useState(false);
  const [remoteResetNotice, setRemoteResetNotice] = useState("");
  const [devicePairing, setDevicePairing] =
    useState<RemoteDevicePairingStatus | null>(null);
  const [pairedDevices, setPairedDevices] = useState<RemotePairedDeviceStatus[]>([]);
  const [devicePairingBusy, setDevicePairingBusy] = useState(false);
  const [copiedRemoteLink, setCopiedRemoteLink] = useState<
    "public" | "lan" | null
  >(null);
  const remoteCopyTimeoutRef = useRef<number>(0);

  useEffect(
    () => () => window.clearTimeout(remoteCopyTimeoutRef.current),
    [],
  );

  useEffect(() => {
    setExcludedFolderNamesDraft(explorerExcludedFolderNames.join(", "));
  }, [explorerExcludedFolderNames]);

  useEffect(() => {
    let alive = true;
    void isEnabled()
      .then((on) => {
        if (!alive) return;
        if (on !== usePreferencesStore.getState().autostart) {
          void setAutostart(on);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!remoteEnabledDraft) {
      setDevicePairing(null);
      setPairedDevices([]);
      return;
    }
    void refreshPairedDevices().catch((error) => {
      console.error("paired device list failed", error);
    });
  }, [remoteEnabledDraft]);

  const onToggleAutostart = async (next: boolean) => {
    try {
      if (next) await enable();
      else await disable();
      await setAutostart(next);
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  useEffect(() => {
    if (remoteBusy) return;
    setRemoteEnabledDraft(remoteAccessEnabled);
  }, [remoteAccessEnabled, remoteBusy]);

  useEffect(() => {
    let alive = true;
    void remoteAccessStatus()
      .then(async (status) => {
        if (!alive) return;
        let nextStatus = status;
        if (
          !status.enabled &&
          usePreferencesStore.getState().remoteAccessEnabled
        ) {
          nextStatus = await remoteAccessStart();
          if (!alive) return;
        }
        setRemoteLanUrl(nextStatus.lanUrl);
        setRemotePublicUrl(nextStatus.publicUrl ?? "");
        setRemoteTunnelState(nextStatus.tunnelState);
        setRemoteTunnelError(nextStatus.tunnelError ?? "");
        setRemoteBootstrapSecret(nextStatus.bootstrapSecret ?? "");
        setRemoteEnabledDraft(nextStatus.enabled);
        if (
          nextStatus.enabled !==
          usePreferencesStore.getState().remoteAccessEnabled
        ) {
          void setRemoteAccessEnabled(nextStatus.enabled);
        }
        setRemoteError(null);
      })
      .catch((e) => {
        console.error("remote access status failed", e);
        if (!alive) return;
        setRemoteError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const onToggleRemoteAccess = async (next: boolean) => {
    setRemoteEnabledDraft(next);
    setRemoteBusy(true);
    try {
      setRemoteError(null);
      await setRemoteAccessEnabled(next);
      const status = next
        ? await remoteAccessStart()
        : await remoteAccessStop();
      setRemoteLanUrl(status.lanUrl);
      setRemotePublicUrl(status.publicUrl ?? "");
      setRemoteTunnelState(status.tunnelState);
      setRemoteTunnelError(status.tunnelError ?? "");
      setRemoteBootstrapSecret(status.bootstrapSecret ?? "");
      setRemoteEnabledDraft(status.enabled);
      await setRemoteAccessEnabled(status.enabled);
    } catch (e) {
      console.error("remote access toggle failed", e);
      setRemoteError(String(e));
      setRemoteEnabledDraft(false);
      await setRemoteAccessEnabled(false);
    } finally {
      setRemoteBusy(false);
    }
  };

  const onResetRemotePassword = async () => {
    if (!remoteEnabledDraft || remoteBusy) return;

    setRemoteResetDialogOpen(false);
    setRemoteBusy(true);
    setRemoteError(null);
    setRemoteResetNotice("");
    try {
      const status = await remoteAccessResetPassword();
      setRemoteLanUrl(status.lanUrl);
      setRemotePublicUrl(status.publicUrl ?? "");
      setRemoteTunnelState(status.tunnelState);
      setRemoteTunnelError(status.tunnelError ?? "");
      setRemoteBootstrapSecret(status.bootstrapSecret ?? "");
      setRemoteEnabledDraft(status.enabled);
      setRemoteResetNotice("Password reset. Scan the new QR to set a password.");
    } catch (error) {
      console.error("remote password reset failed", error);
      setRemoteError(String(error));
    } finally {
      setRemoteBusy(false);
    }
  };

  useEffect(() => {
    if (!remoteEnabledDraft || remoteBusy) return;
    let alive = true;
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      void remoteAccessStatus()
        .then((status) => {
          if (!alive) return;
          setRemoteLanUrl(status.lanUrl);
          setRemotePublicUrl(status.publicUrl ?? "");
          setRemoteTunnelState(status.tunnelState);
          setRemoteTunnelError(status.tunnelError ?? "");
          setRemoteBootstrapSecret(status.bootstrapSecret ?? "");
          setRemoteEnabledDraft(status.enabled);
          if (
            status.enabled !==
            usePreferencesStore.getState().remoteAccessEnabled
          ) {
            void setRemoteAccessEnabled(status.enabled);
          }
          setRemoteError(null);
        })
        .catch((e) => {
          if (!alive) return;
          setRemoteError(String(e));
        })
        .finally(() => {
          pending = false;
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [remoteBusy, remoteEnabledDraft]);

  const remoteQrUrl = remoteSetupUrl(
    remotePublicUrl,
    remoteBootstrapSecret,
  );

  const refreshPairedDevices = async () => {
    if (!remoteEnabledDraft) return;
    setPairedDevices(await remoteDeviceList());
  };

  const onStartDevicePairing = async () => {
    if (!remoteEnabledDraft || devicePairingBusy) return;
    setDevicePairingBusy(true);
    setRemoteError(null);
    try {
      const pairing = await remoteDevicePairingStart();
      setDevicePairing(pairing);
      await refreshPairedDevices();
    } catch (error) {
      setRemoteError(String(error));
    } finally {
      setDevicePairingBusy(false);
    }
  };

  const onRevokeDevice = async (deviceId: string) => {
    if (devicePairingBusy) return;
    setDevicePairingBusy(true);
    try {
      setPairedDevices(await remoteDeviceRevoke(deviceId));
    } catch (error) {
      setRemoteError(String(error));
    } finally {
      setDevicePairingBusy(false);
    }
  };

  const copyRemoteLink = async (kind: "public" | "lan", value: string) => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      window.clearTimeout(remoteCopyTimeoutRef.current);
      setCopiedRemoteLink(kind);
      remoteCopyTimeoutRef.current = window.setTimeout(
        () => setCopiedRemoteLink(null),
        1500,
      );
    } catch {
      // Clipboard access can be denied outside a secure context.
    }
  };

  const saveExcludedFolderNames = () => {
    const normalized = parseExcludedFolderNames(excludedFolderNamesDraft);
    setExcludedFolderNamesDraft(normalized.join(", "));
    void setExplorerExcludedFolderNames(normalized);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="General"
        description="Mode, editor, and startup."
      />

      <div className="flex flex-col gap-2">
        <Label>Appearance</Label>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              className={cn(
                "group flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card transition-all",
                mode === o.id
                  ? "border-foreground/60 ring-1 ring-foreground/20"
                  : "border-border/60 hover:border-border",
              )}
            >
              <HugeiconsIcon icon={o.icon} size={18} strokeWidth={1.5} />
              <span className="text-[11.5px]">{o.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          For theme, background and customization, see the{" "}
          <strong className="font-medium text-foreground">Themes</strong> tab.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Zoom</Label>
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-muted-foreground">
              UI zoom level
            </span>
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
          <Slider
            value={[zoomLevel]}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_SLIDER_STEP}
            onValueChange={(v) => void setZoomLevel(v[0] ?? 1)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Editor</Label>
        <SettingRow
          title="Vim mode"
          description="Enable Vim keybindings in the code editor."
        >
          <Switch
            checked={vimMode}
            onCheckedChange={(v) => void setVimMode(v)}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Explorer</Label>
        <SettingRow
          title="Show hidden files"
          description="Include dot-prefixed files and folders (.env, .gitignore, .config) in the file explorer and search."
        >
          <Switch
            checked={showHidden}
            onCheckedChange={(v) => void setShowHidden(v)}
          />
        </SettingRow>
        <SettingRow
          title="Hidden folders"
          description="Hide exact folder names from the Editor sidebar. Separate names with commas or Shift+Enter."
        >
          <textarea
            rows={2}
            value={excludedFolderNamesDraft}
            placeholder=".git, node_modules, dist, target"
            aria-label="Hidden folders"
            onChange={(event) =>
              setExcludedFolderNamesDraft(event.target.value)
            }
            onBlur={saveExcludedFolderNames}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            className="min-h-12 w-64 resize-y rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11px] outline-none focus:border-foreground/40"
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Terminal</Label>
        <SettingRow
          title={
            <span className="inline-flex items-center gap-1.5">
              Use WebGL renderer
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-help text-[11px] text-muted-foreground/70 leading-none"
                      aria-label="More info about WebGL renderer"
                    >
                      ⓘ
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-65 text-[11px]"
                  >
                    xterm's WebGL renderer caches glyphs in a GPU texture
                    atlas. It can be faster with very busy terminal output,
                    but some macOS input methods and GPU drivers behave better
                    with the default renderer.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          }
          description="Optional hardware acceleration. Leave off if Vietnamese input, text rendering, or pane repainting behaves oddly."
        >
          <Switch
            checked={terminalWebglEnabled}
            onCheckedChange={(v) => void setTerminalWebglEnabled(v)}
          />
        </SettingRow>
        <SettingRow
          title="Copy selected text"
          description="Automatically copy terminal text to the clipboard after a selection settles."
        >
          <Switch
            checked={terminalCopyOnSelection}
            onCheckedChange={(v) => void setTerminalCopyOnSelection(v)}
          />
        </SettingRow>
        <SettingRow
          title="Space"
          description="Show the draggable Space voice control over terminal panes. Cmd/Ctrl+Shift+V starts or stops recording."
        >
          <Switch
            checked={floatingVoiceAgentEnabled}
            onCheckedChange={(v) => void setFloatingVoiceAgentEnabled(v)}
          />
        </SettingRow>
        <SettingRow
          title="Font family"
          description='Nerd Font name for icons (e.g. "CaskaydiaCove Nerd Font Mono"). Leave blank to auto-detect.'
        >
          <input
            type="text"
            value={terminalFontFamily}
            placeholder="Auto-detect"
            onChange={(e) => void setTerminalFontFamily(e.target.value)}
            className="h-8 w-48 rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-foreground/40"
          />
        </SettingRow>
        <SettingRow
          title="Letter spacing"
          description="Extra horizontal space between characters (px). Use negative values to tighten Nerd Fonts."
        >
          <Select
            value={String(terminalLetterSpacing)}
            onValueChange={(v) => void setTerminalLetterSpacing(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LETTER_SPACINGS.map((v) => (
                <SelectItem key={v} value={String(v)} className="text-[12px]">
                  {v > 0 ? `+${v}` : v} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title="Font size" description="Terminal text size.">
          <Select
            value={String(terminalFontSize)}
            onValueChange={(v) => void setTerminalFontSize(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMINAL_FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-[12px]">
                  {size} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Scrollback"
          description="Lines of history kept per terminal. Higher uses more RAM (~3 KB / line)."
        >
          <Select
            value={String(terminalScrollback)}
            onValueChange={(v) => void setTerminalScrollback(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMINAL_SCROLLBACK_PRESETS.map((lines) => (
                <SelectItem
                  key={lines}
                  value={String(lines)}
                  className="text-[12px]"
                >
                  {lines.toLocaleString()} lines
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Network</Label>
        <SettingRow
          title="Allow remote access"
          description="Start cmdSpace's authenticated LAN UI and public tunnel."
        >
          <Switch
            checked={remoteEnabledDraft}
            disabled={remoteBusy}
            onCheckedChange={(v) => void onToggleRemoteAccess(v)}
          />
        </SettingRow>
        {remoteError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-5 text-destructive">
            {formatRemoteError(remoteError)}
          </p>
        ) : null}
        <div className="rounded-xl border border-border/60 bg-card/35 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold">Remote access</div>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Scan the QR or open the public link.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium",
                remoteTunnelState === "ready"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : remoteTunnelState === "error"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-border/60 bg-muted/50 text-muted-foreground",
              )}
            >
              {REMOTE_TUNNEL_LABELS[remoteTunnelState]}
            </span>
          </div>

          {remoteEnabledDraft ? (
            remotePublicUrl ? (
              <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-lg border border-border/50 bg-background/70 p-2.5">
                <div
                  className="grid size-[112px] place-items-center rounded-lg bg-white p-2 shadow-sm"
                  aria-label="Scan to connect"
                >
                  <QRCode
                    value={remoteQrUrl}
                    size={88}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                  />
                </div>
                <div className="min-w-0 py-0.5">
                  <div className="text-[12px] font-medium text-foreground">
                    Scan to connect
                  </div>
                  <p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">
                    Set your password on the first connection.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyRemoteLink("public", remotePublicUrl)}
                      className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border/50 bg-background px-2.5 text-left font-mono text-[10.5px] text-foreground transition-colors hover:bg-muted/70"
                      title={copiedRemoteLink === "public" ? "Copied" : "Copy public link"}
                      aria-label={copiedRemoteLink === "public" ? "Public link copied" : "Copy public link"}
                    >
                      <span className="truncate">{remotePublicUrl}</span>
                      <HugeiconsIcon
                        icon={copiedRemoteLink === "public" ? CheckmarkCircle01Icon : Copy01Icon}
                        size={14}
                        strokeWidth={1.75}
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          copiedRemoteLink === "public" && "text-emerald-600",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void openUrl(remotePublicUrl)}
                      className="h-9 shrink-0 rounded-md border border-border/50 bg-muted/40 px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Open
                    </button>
                  </div>
                  {remoteLanUrl ? (
                    <button
                      type="button"
                      onClick={() => void copyRemoteLink("lan", remoteLanUrl)}
                      className="mt-2 flex w-full items-center justify-between gap-2 rounded-md px-1 text-left transition-colors hover:text-foreground"
                      title={copiedRemoteLink === "lan" ? "Copied" : "Copy LAN fallback link"}
                      aria-label={copiedRemoteLink === "lan" ? "LAN fallback link copied" : "Copy LAN fallback link"}
                    >
                      <span className="min-w-0">
                        <span className="mr-1.5 text-[10px] font-medium text-muted-foreground">
                          LAN fallback
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {remoteLanUrl}
                        </span>
                      </span>
                      <HugeiconsIcon
                        icon={copiedRemoteLink === "lan" ? CheckmarkCircle01Icon : Copy01Icon}
                        size={13}
                        strokeWidth={1.75}
                        className={cn(
                          "shrink-0 text-muted-foreground transition-colors duration-200",
                          copiedRemoteLink === "lan" && "text-emerald-600",
                        )}
                      />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-border/50 bg-background/55 px-3 py-2.5">
                <div className="text-[10px] font-medium text-muted-foreground">
                  Public tunnel
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-foreground">
                  {remoteTunnelState === "starting" ||
                  remoteTunnelState === "degraded"
                    ? "Connecting to localhost.run…"
                    : "Waiting for a public link…"}
                </div>
              </div>
            )
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-background/45 px-3 py-2.5 text-[10.5px] text-muted-foreground">
              Enable remote access to generate a QR and public link.
            </div>
          )}

          {remoteTunnelError ? (
            <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10.5px] leading-5 text-amber-700">
              Public tunnel unavailable. LAN access still works. {remoteTunnelError}
            </p>
          ) : null}

          <div className="mt-3 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold">Native iPhone / iPad</div>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  Create a one-time pairing QR for the native remote app.
                </p>
              </div>
              <button
                type="button"
                disabled={!remoteEnabledDraft || devicePairingBusy}
                onClick={() => void onStartDevicePairing()}
                className="h-9 rounded-md border border-border/50 bg-background px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {devicePairingBusy ? "Preparing…" : "Pair device"}
              </button>
            </div>
            {devicePairing ? (
              <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-lg border border-border/50 bg-background/70 p-2.5">
                <div className="grid size-[112px] place-items-center rounded-lg bg-white p-2 shadow-sm" aria-label="Scan to pair native device">
                  <QRCode
                    value={`cmdspace://device-pair?url=${encodeURIComponent(devicePairing.url)}&grant=${encodeURIComponent(devicePairing.secret)}`}
                    size={88}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                  />
                </div>
                <p className="self-center text-[10.5px] leading-5 text-muted-foreground">
                  This QR expires in 10 minutes and can be used once. Pairing grants terminal access only to this remote runtime.
                </p>
              </div>
            ) : null}
            {pairedDevices.length > 0 ? (
              <ul className="mt-3 divide-y divide-border/50 rounded-lg border border-border/50 bg-background/45">
                {pairedDevices.map((device) => (
                  <li key={device.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{device.displayName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{device.id}</p>
                    </div>
                    {device.revoked ? (
                      <span className="text-[10px] text-muted-foreground">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        disabled={devicePairingBusy}
                        onClick={() => void onRevokeDevice(device.id)}
                        className="h-8 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 text-[10.5px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!remoteEnabledDraft || remoteBusy}
              onClick={() => setRemoteResetDialogOpen(true)}
              className="h-8 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset remote password
            </button>
          </div>
          {remoteResetNotice ? (
            <p className="mt-2 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[10.5px] leading-5 text-emerald-700">
              {remoteResetNotice}
            </p>
          ) : null}
        </div>
      </div>

      <AlertDialog open={remoteResetDialogOpen} onOpenChange={setRemoteResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset remote password?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign out every connected device and invalidate the old
              password. You will need to scan the new setup QR and create a new
              password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void onResetRemotePassword()}
            >
              Reset password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-2">
        <Label>Startup</Label>
        <div className="flex flex-col gap-2">
          <SettingRow
            title="Launch at login"
            description="Open cmdSpace automatically when you sign in."
          >
            <Switch
              checked={autostart}
              onCheckedChange={(v) => void onToggleAutostart(v)}
            />
          </SettingRow>
          <SettingRow
            title="Restore window position & size"
            description="Reopen the main window where you left it. Applies on next launch."
          >
            <Switch
              checked={restoreWindowState}
              onCheckedChange={(v) => void setRestoreWindowState(v)}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
      {children}
    </span>
  );
}
