import type { RemoteDevicePairingStatus } from "@/modules/settings/remoteAccess";

export function buildNativeDevicePairingUrl(
  pairing: RemoteDevicePairingStatus | null,
): string {
  if (!pairing) return "";
  return `cmdspace://device-pair?url=${encodeURIComponent(pairing.url)}&relay=${encodeURIComponent(pairing.relay)}&relayId=${encodeURIComponent(pairing.relayId)}&grant=${encodeURIComponent(pairing.secret)}`;
}
