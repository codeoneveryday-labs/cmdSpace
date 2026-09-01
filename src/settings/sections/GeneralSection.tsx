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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_SLIDER_STEP } from "@/lib/zoomConstants";
import { parseExcludedFolderNames } from "@/modules/explorer/lib/excludedFolders";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { TerminalShell, ThemePref } from "@/modules/settings/store";
import {
  setAutostart,
  setExplorerExcludedFolderNames,
  setRestoreWindowState,
  setShowHidden,
  setVimMode,
  setZoomLevel,
} from "@/modules/settings/store";
import { useTheme } from "@/modules/theme";
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";
import { RemoteAccessHub } from "./RemoteAccessHub";
import {
  setNativeAutostartEnabled,
  synchronizeNativeAutostartPreference,
} from "./autostartPreferenceAdapter";
import { buildNativeDevicePairingUrl } from "./remoteDevicePairingUrl";
import {
  TerminalPreferencesSection,
  TERMINAL_SHELLS,
} from "./TerminalPreferencesSection";
import { useRemoteDevicePairing } from "./useRemoteDevicePairing";
import { useRemoteTunnelSettings } from "./useRemoteTunnelSettings";

const APPEARANCE: {
  id: ThemePref;
  label: string;
  icon: typeof ComputerIcon;
}[] = [
  { id: "system", label: "System", icon: ComputerIcon },
  { id: "light", label: "Light", icon: Sun03Icon },
  { id: "dark", label: "Dark", icon: Moon02Icon },
];

function formatRemoteError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("command")) {
    return "Remote access backend is not loaded yet. Restart the app once, then try again.";
  }
  return error;
}

export function GeneralSection() {
  const { mode, setMode } = useTheme();

  const autostart = usePreferencesStore((s) => s.autostart);
  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const vimMode = usePreferencesStore((s) => s.vimMode);
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const explorerExcludedFolderNames = usePreferencesStore(
    (s) => s.explorerExcludedFolderNames,
  );
  const zoomLevel = usePreferencesStore((s) => s.zoomLevel);
  const [excludedFolderNamesDraft, setExcludedFolderNamesDraft] = useState(
    explorerExcludedFolderNames.join(", "),
  );
  const [availableTerminalShells, setAvailableTerminalShells] = useState<
    TerminalShell[]
  >(TERMINAL_SHELLS.map((shell) => shell.id));
  const {
    enabled: remoteEnabledDraft,
    lanUrl: remoteLanUrl,
    publicUrl: remotePublicUrl,
    tunnelState: remoteTunnelState,
    tunnelError: remoteTunnelError,
    busy: remoteBusy,
    error: remoteError,
    setError: setRemoteError,
    resetDialogOpen: remoteResetDialogOpen,
    resetNotice: remoteResetNotice,
    copiedLink: copiedRemoteLink,
    setupQrUrl: remoteQrUrl,
    copyLink: copyRemoteLink,
    resetPassword: onResetRemotePassword,
    setResetDialogOpen: setRemoteResetDialogOpen,
    toggle: onToggleRemoteAccess,
  } = useRemoteTunnelSettings();
  useEffect(() => {
    void invoke<TerminalShell[]>("pty_available_shells")
      .then(setAvailableTerminalShells)
      .catch(() => setAvailableTerminalShells(["system"]));
  }, []);

  useEffect(() => {
    setExcludedFolderNamesDraft(explorerExcludedFolderNames.join(", "));
  }, [explorerExcludedFolderNames]);

  useEffect(() => {
    let alive = true;
    void synchronizeNativeAutostartPreference({
      isEnabled,
      currentPreference: () =>
        alive ? usePreferencesStore.getState().autostart : null,
      persist: setAutostart,
    })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const {
    pairing: devicePairing,
    devices: pairedDevices,
    busy: devicePairingBusy,
    startPairing: onStartDevicePairing,
    revokeDevice: onRevokeDevice,
  } = useRemoteDevicePairing({
    enabled: remoteEnabledDraft,
    publicUrl: remotePublicUrl,
    onError: setRemoteError,
  });

  const nativeDevicePairingUrl = buildNativeDevicePairingUrl(devicePairing);

  const onToggleAutostart = async (next: boolean) => {
    try {
      await setNativeAutostartEnabled(
        { enable, disable, persist: setAutostart },
        next,
      );
    } catch (e) {
      console.error("autostart toggle failed", e);
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

      <TerminalPreferencesSection availableShells={availableTerminalShells} />

      <div className="flex flex-col gap-2">
        <Label>Network</Label>
        {remoteError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-5 text-destructive">
            {formatRemoteError(remoteError)}
          </p>
        ) : null}
        <RemoteAccessHub
          enabled={remoteEnabledDraft}
          busy={remoteBusy}
          tunnelState={remoteTunnelState}
          tunnelError={remoteTunnelError}
          publicUrl={remotePublicUrl}
          lanUrl={remoteLanUrl}
          setupQrUrl={remoteQrUrl}
          copiedLink={copiedRemoteLink}
          resetNotice={remoteResetNotice}
          pairing={devicePairing}
          pairingUrl={nativeDevicePairingUrl}
          pairingBusy={devicePairingBusy}
          devices={pairedDevices}
          onToggle={(enabled) => void onToggleRemoteAccess(enabled)}
          onCopy={(kind, value) => void copyRemoteLink(kind, value)}
          onOpenPublic={() => void openUrl(remotePublicUrl)}
          onStartPairing={() => void onStartDevicePairing()}
          onRevokeDevice={(deviceId) => void onRevokeDevice(deviceId)}
          onResetPassword={() => setRemoteResetDialogOpen(true)}
        />
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
