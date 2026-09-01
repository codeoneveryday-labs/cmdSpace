import {
  remoteDeviceList,
  remoteDevicePairingStart,
  remoteDeviceRevoke,
} from "@/modules/settings/remoteAccess";
import type {
  RemoteDevicePairingStatus,
  RemotePairedDeviceStatus,
} from "@/modules/settings/remoteAccess";
import { useCallback, useEffect, useState } from "react";

export function useRemoteDevicePairing({
  enabled,
  publicUrl,
  onError,
}: {
  enabled: boolean;
  publicUrl: string;
  onError: (message: string | null) => void;
}) {
  const [pairing, setPairing] = useState<RemoteDevicePairingStatus | null>(null);
  const [devices, setDevices] = useState<RemotePairedDeviceStatus[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshDevices = useCallback(async () => {
    if (!enabled) return;
    setDevices(await remoteDeviceList());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPairing(null);
      setDevices([]);
      return;
    }
    void refreshDevices().catch((error) => {
      console.error("paired device list failed", error);
    });
  }, [enabled, refreshDevices]);

  useEffect(() => {
    setPairing(null);
  }, [publicUrl]);

  const startPairing = useCallback(async () => {
    if (!enabled || busy) return;
    setBusy(true);
    onError(null);
    try {
      const nextPairing = await remoteDevicePairingStart();
      setPairing(nextPairing);
      await refreshDevices();
    } catch (error) {
      onError(String(error));
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, onError, refreshDevices]);

  const revokeDevice = useCallback(async (deviceId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      setDevices(await remoteDeviceRevoke(deviceId));
    } catch (error) {
      onError(String(error));
    } finally {
      setBusy(false);
    }
  }, [busy, onError]);

  return {
    pairing,
    devices,
    busy,
    startPairing,
    revokeDevice,
  };
}
