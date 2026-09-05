import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  RemoteDevicePairingStatus,
  RemotePairedDeviceStatus,
  RemoteTunnelState,
} from "@/modules/settings/remoteAccess";
import { groupRemoteDevices } from "./remoteDeviceGroups";
import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  MoreHorizontalIcon,
  QrCodeIcon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import QRCode from "react-qr-code";

export type RemoteCopyKind = "public" | "lan" | "device";

export type RemoteAccessHubProps = {
  enabled: boolean;
  busy: boolean;
  tunnelState: RemoteTunnelState;
  tunnelError: string;
  publicUrl: string;
  lanUrl: string;
  setupQrUrl: string;
  copiedLink: RemoteCopyKind | null;
  resetNotice: string;
  pairing: RemoteDevicePairingStatus | null;
  pairingUrl: string;
  pairingBusy: boolean;
  devices: RemotePairedDeviceStatus[];
  onToggle: (enabled: boolean) => void;
  onCopy: (kind: RemoteCopyKind, value: string) => void;
  onOpenPublic: () => void;
  onStartPairing: () => void;
  onRevokeDevice: (deviceId: string) => void;
  onResetPassword: () => void;
};

const TUNNEL_LABELS: Record<RemoteTunnelState, string> = {
  starting: "Starting",
  ready: "Online",
  degraded: "Reconnecting",
  error: "LAN only",
  stopped: "Off",
};

function publicHostname(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function shortDeviceId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 9)}…${id.slice(-6)}`;
}

function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <HugeiconsIcon
      icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
      size={14}
      strokeWidth={1.75}
      className={cn("shrink-0", copied && "text-emerald-600")}
    />
  );
}

function QrPanel({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid size-32 shrink-0 place-items-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5"
        aria-label={label}
      >
        <QRCode
          value={value}
          size={104}
          bgColor="#ffffff"
          fgColor="#111827"
          level="M"
        />
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function RemoteAccessHub({
  enabled,
  busy,
  tunnelState,
  tunnelError,
  publicUrl,
  lanUrl,
  setupQrUrl,
  copiedLink,
  resetNotice,
  pairing,
  pairingUrl,
  pairingBusy,
  devices,
  onToggle,
  onCopy,
  onOpenPublic,
  onStartPairing,
  onRevokeDevice,
  onResetPassword,
}: RemoteAccessHubProps) {
  const activeDevices = devices.filter((device) => !device.revoked);
  const deviceGroups = groupRemoteDevices(activeDevices);
  const ready = enabled && tunnelState === "ready" && Boolean(publicUrl);
  const statusTone =
    tunnelState === "ready"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tunnelState === "error" || tunnelState === "degraded"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border/60 bg-muted/50 text-muted-foreground";

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/35 shadow-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">
              Remote access
            </h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                statusTone,
              )}
            >
              {enabled ? TUNNEL_LABELS[tunnelState] : "Off"}
            </span>
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            Control cmdSpace from another device.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={onToggle}
          aria-label={`${enabled ? "Disable" : "Enable"} remote access`}
        />
      </div>

      {!enabled ? (
        <div className="border-t border-border/50 bg-background/40 px-4 py-3 text-[10.5px] text-muted-foreground">
          Turn on Remote access to create a secure public connection and pair
          mobile devices.
        </div>
      ) : (
        <div className="border-t border-border/50">
          <section className="px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Public connection
            </div>
            {ready ? (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-lg border border-border/55 bg-background/75 px-3 py-2.5">
                  <div className="truncate font-mono text-[11px] text-foreground">
                    {publicHostname(publicUrl)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenPublic}
                  className="h-9 rounded-lg bg-foreground px-3 text-[10.5px] font-semibold text-background transition-opacity hover:opacity-85"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onCopy("public", publicUrl)}
                  className="grid size-9 place-items-center rounded-lg border border-border/55 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={copiedLink === "public" ? "Copied" : "Copy public link"}
                  aria-label={copiedLink === "public" ? "Public link copied" : "Copy public link"}
                >
                  <CopyIcon copied={copiedLink === "public"} />
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/55 bg-background px-2.5 text-[10.5px] font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <HugeiconsIcon icon={QrCodeIcon} size={14} strokeWidth={1.75} />
                      Show QR
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-96 rounded-2xl p-4">
                    <QrPanel
                      value={setupQrUrl}
                      label="Scan to connect"
                      description="Scan from another device. Set your password on the first connection."
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg border border-border/50 bg-background/55 px-3 py-2.5">
                <div className="text-[10.5px] font-medium text-foreground">
                  {tunnelState === "error"
                    ? "Public link unavailable"
                    : "Connecting to public tunnel…"}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {lanUrl
                    ? "LAN access remains available under Advanced."
                    : "This usually takes a few seconds."}
                </p>
              </div>
            )}
          </section>

          <section className="border-t border-border/50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-[11.5px] font-semibold text-foreground">
                    Paired devices
                  </h4>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9.5px] tabular-nums text-muted-foreground">
                    {activeDevices.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Native mobile device access.
                </p>
              </div>
              <Popover
                onOpenChange={(open) => {
                  if (open && !pairingBusy) onStartPairing();
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!publicUrl || pairingBusy}
                    className="h-8 rounded-lg border border-border/55 bg-background px-3 text-[10.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {pairingBusy ? "Preparing…" : "Pair mobile device"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 rounded-2xl p-4">
                  {pairing && pairingUrl ? (
                    <div className="space-y-3">
                      <QrPanel
                        value={pairingUrl}
                        label="Scan to pair mobile device"
                        description="One-time pairing QR. It expires after 10 minutes and grants terminal access to this runtime only."
                      />
                      <button
                        type="button"
                        onClick={() => onCopy("device", pairingUrl)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/55 px-2.5 text-[10.5px] font-medium transition-colors hover:bg-muted"
                      >
                        <CopyIcon copied={copiedLink === "device"} />
                        {copiedLink === "device" ? "Copied" : "Copy pairing link"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Preparing one-time pairing QR…
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-border/50 bg-background/45">
              {deviceGroups.length > 0 ? (
                deviceGroups.flatMap((group, groupIndex) =>
                  group.devices.map((device, deviceIndex) => (
                    <div
                      key={device.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5",
                        groupIndex > 0 && deviceIndex === 0 && "border-t border-border/50",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <HugeiconsIcon icon={SmartPhone01Icon} size={14} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[10.5px] font-medium text-foreground">
                            {deviceIndex === 0 ? group.displayName : "Identity"}
                          </p>
                          {deviceIndex === 0 && group.devices.length > 1 ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground">
                              {group.devices.length} identities
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate font-mono text-[9.5px] text-muted-foreground">
                          {shortDeviceId(device.id)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={pairingBusy}
                            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-45"
                            aria-label={`Manage ${device.displayName} identity ${shortDeviceId(device.id)}`}
                          >
                            <HugeiconsIcon icon={MoreHorizontalIcon} size={15} strokeWidth={1.8} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40 rounded-xl">
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onRevokeDevice(device.id)}
                          >
                            Revoke access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )),
                )
              ) : (
                <div className="px-3 py-3 text-[10.5px] text-muted-foreground">
                  No mobile devices paired yet.
                </div>
              )}
            </div>
          </section>

          <details className="group border-t border-border/50">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[10.5px] font-medium text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground">
              Advanced
              <span className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-3 border-t border-border/40 bg-background/35 px-4 py-3">
              {lanUrl ? (
                <button
                  type="button"
                  onClick={() => onCopy("lan", lanUrl)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 bg-background px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[9.5px] font-medium text-muted-foreground">
                      LAN fallback
                    </span>
                    <span className="block truncate font-mono text-[10px] text-foreground">
                      {lanUrl}
                    </span>
                  </span>
                  <CopyIcon copied={copiedLink === "lan"} />
                </button>
              ) : null}
              {tunnelError ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-5 text-amber-700 dark:text-amber-400">
                  {tunnelError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onResetPassword}
                  className="h-8 rounded-lg border border-destructive/25 bg-destructive/5 px-3 text-[10.5px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-45"
                >
                  Reset remote password
                </button>
              </div>
            </div>
          </details>

          {resetNotice ? (
            <p className="border-t border-border/50 bg-emerald-500/10 px-4 py-2 text-[10.5px] text-emerald-700 dark:text-emerald-400">
              {resetNotice}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
